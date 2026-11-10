import type { Context } from 'hono';
import type { Env } from '../types';
import { randomToken, sha256Hex } from '../lib/crypto';

export const SESSION_COOKIE = 'da_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_TTL_REMEMBER_SECONDS = 30 * 24 * 60 * 60;

export interface SessionState {
  authenticated: boolean;
  mustChangePassword: boolean;
  tokenHash: string | null;
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

function isSecureRequest(c: Context<{ Bindings: Env }>): boolean {
  try {
    return new URL(c.req.url).protocol === 'https:';
  } catch {
    return true;
  }
}

export async function readSession(c: Context<{ Bindings: Env }>): Promise<SessionState> {
  const token = readCookie(c.req.header('cookie'), SESSION_COOKIE);
  if (!token) return { authenticated: false, mustChangePassword: false, tokenHash: null };

  const tokenHash = await sha256Hex(token);
  const row = await c.env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, new Date().toISOString())
    .first<{ expires_at: string }>();

  if (!row) return { authenticated: false, mustChangePassword: false, tokenHash: null };

  const admin = await c.env.DB.prepare('SELECT must_change_password FROM admin WHERE id = 1').first<{
    must_change_password: number;
  }>();

  return {
    authenticated: true,
    mustChangePassword: admin?.must_change_password === 1,
    tokenHash,
  };
}

export interface CreatedSession {
  token: string;
  tokenHash: string;
  expiresAt: string;
}

export async function createSession(
  db: D1Database,
  ttlSeconds: number,
  ip: string | null,
  userAgent: string | null,
): Promise<CreatedSession> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  await db
    .prepare('INSERT INTO sessions (token_hash, created_at, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?)')
    .bind(tokenHash, now.toISOString(), expiresAt, ip, userAgent)
    .run();

  return { token, tokenHash, expiresAt };
}

export async function deleteSession(db: D1Database, tokenHash: string | null): Promise<void> {
  if (!tokenHash) return;
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

export async function deleteAllSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions').run();
}

export function sessionCookie(c: Context<{ Bindings: Env }>, token: string, maxAgeSeconds: number): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(c)) parts.splice(1, 0, 'Secure');
  return parts.join('; ');
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (isSecureRequest(c)) parts.splice(1, 0, 'Secure');
  return parts.join('; ');
}

export function clientIp(c: Context<{ Bindings: Env }>): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
}

/** 登录频率限制 */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

export interface RateLimitState {
  blocked: boolean;
  retryAfter: number;
  failures: number;
}

export async function checkLoginRateLimit(db: D1Database, ip: string): Promise<RateLimitState> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const row = await db
    .prepare('SELECT count(*) AS n, min(ts) AS first FROM login_attempts WHERE ip = ? AND ok = 0 AND ts > ?')
    .bind(ip, since)
    .first<{ n: number; first: string | null }>();

  const failures = row?.n ?? 0;
  if (failures < LOGIN_MAX_FAILURES) return { blocked: false, retryAfter: 0, failures };

  const first = row?.first ? Date.parse(row.first) : Date.now();
  const retryAfter = Math.max(1, Math.ceil((first + LOGIN_WINDOW_MS - Date.now()) / 1000));
  return { blocked: true, retryAfter, failures };
}

export async function recordLoginAttempt(db: D1Database, ip: string, ok: boolean): Promise<void> {
  await db
    .prepare('INSERT INTO login_attempts (ip, ts, ok) VALUES (?, ?, ?)')
    .bind(ip, new Date().toISOString(), ok ? 1 : 0)
    .run();
}
