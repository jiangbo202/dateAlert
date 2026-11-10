import { Hono } from 'hono';
import type { Env } from '../types';
import { derivePepper, hashPassword, verifyPassword } from '../lib/crypto';
import { validatePassword } from '../lib/validation';
import {
  checkLoginRateLimit,
  clearSessionCookie,
  clientIp,
  createSession,
  deleteAllSessions,
  deleteSession,
  readSession,
  recordLoginAttempt,
  SESSION_TTL_REMEMBER_SECONDS,
  SESSION_TTL_SECONDS,
  sessionCookie,
} from '../middleware/session';

export const authRoutes = new Hono<{ Bindings: Env }>();

function fail(code: string, message: string, status: 400 | 401 | 403 | 429, extra?: Record<string, unknown>) {
  return { error: { code, message, ...extra } };
}

async function isInitialized(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM admin WHERE id = 1').first<{ id: number }>();
  return Boolean(row);
}

authRoutes.get('/me', async (c) => {
  const session = await readSession(c);
  const initialized = await isInitialized(c.env.DB);
  return c.json({
    initialized,
    authenticated: session.authenticated,
    mustChangePassword: session.mustChangePassword,
    setupRequiresToken: Boolean(c.env.SETUP_TOKEN),
  });
});

/**
 * 首次初始化管理员密码。
 * 仅当 admin 表为空时可用；之后返回 409。
 * 若配置了 SETUP_TOKEN，则请求体必须携带相同的 token。
 */
authRoutes.post('/setup', async (c) => {
  if (await isInitialized(c.env.DB)) {
    return c.json(fail('ALREADY_INITIALIZED', 'admin is already initialized', 403), 403);
  }

  const body = (await c.req.json().catch(() => null)) as { password?: unknown; token?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';

  if (c.env.SETUP_TOKEN) {
    const token = typeof body?.token === 'string' ? body.token : '';
    if (token !== c.env.SETUP_TOKEN) {
      return c.json(fail('SETUP_TOKEN_INVALID', 'invalid setup token', 403), 403);
    }
  }

  const validation = validatePassword(password);
  if (!validation.ok) {
    return c.json(
      { error: { code: 'VALIDATION_FAILED', message: 'password is invalid', issues: validation.issues } },
      400,
    );
  }

  const ip = clientIp(c);
  const limit = await checkLoginRateLimit(c.env.DB, ip);
  if (limit.blocked) {
    c.header('Retry-After', String(limit.retryAfter));
    return c.json(fail('TOO_MANY_ATTEMPTS', 'too many attempts', 429, { retryAfter: limit.retryAfter }), 429);
  }

  const pepper = await derivePepper(c.env.SECRET_KEY);
  const hashed = await hashPassword(password, pepper);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO admin (id, password_hash, must_change_password, updated_at)
     VALUES (1, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash,
       must_change_password = 0, updated_at = excluded.updated_at`,
  )
    .bind(hashed, now)
    .run();

  await deleteAllSessions(c.env.DB);
  const session = await createSession(c.env.DB, SESSION_TTL_SECONDS, ip, c.req.header('user-agent') ?? null);
  c.header('Set-Cookie', sessionCookie(c, session.token, SESSION_TTL_SECONDS));

  return c.json({ initialized: true, authenticated: true, mustChangePassword: false });
});

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { password?: unknown; remember?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  const remember = body?.remember === true;

  if (!password) return c.json(fail('VALIDATION_FAILED', 'password is required', 400), 400);

  const ip = clientIp(c);
  const limit = await checkLoginRateLimit(c.env.DB, ip);
  if (limit.blocked) {
    c.header('Retry-After', String(limit.retryAfter));
    return c.json(fail('TOO_MANY_ATTEMPTS', 'too many attempts', 429, { retryAfter: limit.retryAfter }), 429);
  }

  const admin = await c.env.DB.prepare('SELECT password_hash, must_change_password FROM admin WHERE id = 1').first<{
    password_hash: string;
    must_change_password: number;
  }>();

  const pepper = await derivePepper(c.env.SECRET_KEY);
  const ok = admin ? await verifyPassword(password, admin.password_hash, pepper) : false;
  await recordLoginAttempt(c.env.DB, ip, ok);

  if (!ok) return c.json(fail('PASSWORD_WRONG', 'password is incorrect', 401), 401);

  const ttl = remember ? SESSION_TTL_REMEMBER_SECONDS : SESSION_TTL_SECONDS;
  const session = await createSession(c.env.DB, ttl, ip, c.req.header('user-agent') ?? null);
  c.header('Set-Cookie', sessionCookie(c, session.token, ttl));

  return c.json({
    initialized: true,
    authenticated: true,
    mustChangePassword: admin?.must_change_password === 1,
  });
});

authRoutes.post('/logout', async (c) => {
  const session = await readSession(c);
  if (session.tokenHash) await deleteSession(c.env.DB, session.tokenHash);
  c.header('Set-Cookie', clearSessionCookie(c));
  return c.json({ authenticated: false });
});

authRoutes.post('/change-password', async (c) => {
  const session = await readSession(c);
  if (!session.authenticated) return c.json(fail('UNAUTHENTICATED', 'login required', 401), 401);

  const body = (await c.req.json().catch(() => null)) as
    | { oldPassword?: unknown; newPassword?: unknown }
    | null;
  const oldPassword = typeof body?.oldPassword === 'string' ? body.oldPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!oldPassword) return c.json(fail('VALIDATION_FAILED', 'oldPassword is required', 400), 400);

  const admin = await c.env.DB.prepare('SELECT password_hash FROM admin WHERE id = 1').first<{
    password_hash: string;
  }>();
  if (!admin) return c.json(fail('INTERNAL', 'admin not initialized', 500), 500);

  const pepper = await derivePepper(c.env.SECRET_KEY);
  if (!(await verifyPassword(oldPassword, admin.password_hash, pepper))) {
    return c.json(fail('PASSWORD_WRONG', 'old password is incorrect', 401), 401);
  }

  const validation = validatePassword(newPassword);
  if (!validation.ok) {
    return c.json(
      { error: { code: 'VALIDATION_FAILED', message: 'new password is invalid', issues: validation.issues } },
      400,
    );
  }

  if (newPassword === oldPassword) {
    return c.json(fail('VALIDATION_FAILED', 'new password must differ from the old one', 400), 400);
  }

  const hashed = await hashPassword(newPassword, pepper);
  await c.env.DB.prepare('UPDATE admin SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = 1')
    .bind(hashed, new Date().toISOString())
    .run();

  await deleteAllSessions(c.env.DB);

  const ip = clientIp(c);
  const ttl = SESSION_TTL_SECONDS;
  const fresh = await createSession(c.env.DB, ttl, ip, c.req.header('user-agent') ?? null);
  c.header('Set-Cookie', sessionCookie(c, fresh.token, ttl));

  return c.json({ authenticated: true, mustChangePassword: false });
});
