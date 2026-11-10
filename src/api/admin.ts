import { Hono, type Context } from 'hono';
import type { Env, ReminderRow } from '../types';
import { getSettings, saveSettings } from '../lib/settings';
import type { Settings } from '../types';
import { validateSettingsPayload } from '../lib/settings-validation';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { sendBark } from '../lib/bark';
import { testMessage } from '../lib/i18n.server';
import { writeLog } from '../cron';
import { decideArchival, toReminderItem } from '../lib/reminders';
import { validateReminderInput } from '../lib/validation';
import { todayInTz } from '../lib/time';
import { readSession } from '../middleware/session';

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use('*', async (c, next) => {
  const session = await readSession(c);
  if (!session.authenticated) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'login required' } }, 401);
  }
  if (session.mustChangePassword) {
    return c.json({ error: { code: 'MUST_CHANGE_PASSWORD', message: 'change password required' } }, 403);
  }
  await next();
});

function errorBody(code: string, message: string, extra?: Record<string, unknown>) {
  return { error: { code, message, ...extra } };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const SELECT_COLUMNS = `id, title, note, due_date, is_public, is_done, done_at, done_by,
                        notify_mode, notify_offsets, created_at, updated_at`;

function readInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  const truncated = Math.trunc(value);
  if (truncated < min) return fallback;
  return Math.min(truncated, max);
}

async function loadRow(db: D1Database, id: string): Promise<ReminderRow | null> {
  return db.prepare(`SELECT ${SELECT_COLUMNS} FROM reminders WHERE id = ?`).bind(id).first<ReminderRow>();
}

async function respondItem(c: Context<{ Bindings: Env }>, row: ReminderRow, status: 200 | 201 = 200) {
  const settings = await getSettings(c.env.DB);
  const today = todayInTz(settings.tz);
  return c.json({ item: toReminderItem(row, today, settings.colors) }, status);
}

adminRoutes.get('/reminders', async (c) => {
  const settings = await getSettings(c.env.DB);
  const today = todayInTz(settings.tz);

  const scope = c.req.query('scope') ?? 'active';
  const q = (c.req.query('q') ?? '').trim();
  const page = readInt(c.req.query('page'), 1, 1, 10_000);
  const size = readInt(c.req.query('size'), 20, 1, 100);

  const where: string[] = [];
  const params: unknown[] = [];

  if (scope === 'active') where.push('is_done = 0');
  else if (scope === 'archived') where.push('is_done = 1');
  else if (scope === 'undated') where.push("is_done = 0 AND due_date = ''");

  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(`(title LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')`);
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql =
    scope === 'archived'
      ? 'ORDER BY done_at DESC, due_date DESC'
      : "ORDER BY is_done ASC, CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date ASC, created_at DESC";

  const [countRow, list] = await Promise.all([
    c.env.DB.prepare(`SELECT count(*) AS total FROM reminders ${whereSql}`)
      .bind(...params)
      .first<{ total: number }>(),
    c.env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM reminders ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
      .bind(...params, size, (page - 1) * size)
      .all<ReminderRow>(),
  ]);

  return c.json({
    items: list.results.map((row) => toReminderItem(row, today, settings.colors)),
    total: countRow?.total ?? 0,
    page,
    size,
  });
});

adminRoutes.post('/reminders/purge-archived', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM reminders WHERE is_done = 1').run();
  return c.json({ deleted: result.meta.changes ?? 0 });
});

adminRoutes.get('/reminders/:id', async (c) => {
  const row = await loadRow(c.env.DB, c.req.param('id'));
  if (!row) return c.json(errorBody('NOT_FOUND', 'reminder not found'), 404);
  return respondItem(c, row);
});

adminRoutes.post('/reminders', async (c) => {
  const body = await c.req.json().catch(() => null);
  const validation = validateReminderInput(body);
  if (!validation.ok || !validation.value) {
    return c.json(errorBody('VALIDATION_FAILED', 'invalid reminder', { issues: validation.issues }), 400);
  }

  const settings = await getSettings(c.env.DB);
  const today = todayInTz(settings.tz);
  const now = new Date();
  const input = validation.value;

  const decision = decideArchival({ isDone: 0, doneBy: null, doneAt: null }, input.dueDate, today, now);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO reminders (id, title, note, due_date, is_public, is_done, done_at, done_by,
                            notify_mode, notify_offsets, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.title,
      input.note,
      input.dueDate,
      input.isPublic ? 1 : 0,
      decision.isDone,
      decision.doneAt,
      decision.doneBy,
      input.notifyMode,
      input.notifyOffsets ? JSON.stringify(input.notifyOffsets) : null,
      now.toISOString(),
      now.toISOString(),
    )
    .run();

  const row = await loadRow(c.env.DB, id);
  if (!row) return c.json(errorBody('INTERNAL', 'create failed'), 500);
  return respondItem(c, row, 201);
});

adminRoutes.patch('/reminders/:id', async (c) => {
  const existing = await loadRow(c.env.DB, c.req.param('id'));
  if (!existing) return c.json(errorBody('NOT_FOUND', 'reminder not found'), 404);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json(errorBody('BAD_JSON', 'invalid body'), 400);

  const merged = {
    title: body.title ?? existing.title,
    note: body.note ?? existing.note,
    dueDate: body.dueDate ?? existing.due_date,
    isPublic: body.isPublic ?? existing.is_public === 1,
    notifyMode: body.notifyMode ?? existing.notify_mode,
    notifyOffsets:
      body.notifyOffsets !== undefined
        ? body.notifyOffsets
        : existing.notify_offsets
          ? JSON.parse(existing.notify_offsets)
          : null,
  };

  const validation = validateReminderInput(merged);
  if (!validation.ok || !validation.value) {
    return c.json(errorBody('VALIDATION_FAILED', 'invalid reminder', { issues: validation.issues }), 400);
  }

  const settings = await getSettings(c.env.DB);
  const today = todayInTz(settings.tz);
  const now = new Date();
  const input = validation.value;

  const decision = decideArchival(
    { isDone: existing.is_done, doneBy: existing.done_by, doneAt: existing.done_at },
    input.dueDate,
    today,
    now,
  );

  await c.env.DB.prepare(
    `UPDATE reminders SET title = ?, note = ?, due_date = ?, is_public = ?,
            is_done = ?, done_at = ?, done_by = ?,
            notify_mode = ?, notify_offsets = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(
      input.title,
      input.note,
      input.dueDate,
      input.isPublic ? 1 : 0,
      decision.isDone,
      decision.doneAt,
      decision.doneBy,
      input.notifyMode,
      input.notifyOffsets ? JSON.stringify(input.notifyOffsets) : null,
      now.toISOString(),
      existing.id,
    )
    .run();

  const row = await loadRow(c.env.DB, existing.id);
  if (!row) return c.json(errorBody('INTERNAL', 'update failed'), 500);
  return respondItem(c, row);
});

adminRoutes.post('/reminders/:id/archive', async (c) => {
  const existing = await loadRow(c.env.DB, c.req.param('id'));
  if (!existing) return c.json(errorBody('NOT_FOUND', 'reminder not found'), 404);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE reminders SET is_done = 1, done_at = ?, done_by = 'manual', updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, existing.id)
    .run();

  const row = await loadRow(c.env.DB, existing.id);
  return respondItem(c, row as ReminderRow);
});

adminRoutes.post('/reminders/:id/restore', async (c) => {
  const existing = await loadRow(c.env.DB, c.req.param('id'));
  if (!existing) return c.json(errorBody('NOT_FOUND', 'reminder not found'), 404);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE reminders SET is_done = 0, done_at = NULL, done_by = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(now, existing.id)
    .run();

  const row = await loadRow(c.env.DB, existing.id);
  return respondItem(c, row as ReminderRow);
});

adminRoutes.delete('/reminders/:id', async (c) => {
  const existing = await loadRow(c.env.DB, c.req.param('id'));
  if (!existing) return c.json(errorBody('NOT_FOUND', 'reminder not found'), 404);

  await c.env.DB.prepare('DELETE FROM reminders WHERE id = ?').bind(existing.id).run();
  return c.json({ deleted: true });
});

function maskSettings(settings: Settings) {
  const { keyCipher, ...bark } = settings.notify.bark;
  return {
    ...settings,
    notify: {
      ...settings.notify,
      bark: { ...bark, hasKey: keyCipher.length > 0 },
    },
  };
}

adminRoutes.get('/settings', async (c) => {
  const settings = await getSettings(c.env.DB);
  return c.json(maskSettings(settings));
});

adminRoutes.put('/settings', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json(errorBody('BAD_JSON', 'invalid body'), 400);

  const current = await getSettings(c.env.DB);
  const incoming = structuredClone(body);
  const notify = (incoming.notify ?? {}) as Record<string, unknown>;
  const bark = (notify.bark ?? {}) as Record<string, unknown>;

  let keyCipher = current.notify.bark.keyCipher;
  if (bark.clearKey === true) keyCipher = '';
  const plainKey = typeof bark.key === 'string' ? bark.key.trim() : '';
  if (plainKey) keyCipher = await encryptSecret(plainKey, c.env.SECRET_KEY);

  delete bark.key;
  delete bark.clearKey;
  delete bark.hasKey;
  bark.keyCipher = keyCipher;
  notify.bark = bark;
  incoming.notify = notify;

  const validation = validateSettingsPayload(incoming);
  if (!validation.ok || !validation.value) {
    const hasOverlap = validation.issues.some((issue) => issue.code === 'RULE_OVERLAP');
    return c.json(
      errorBody(hasOverlap ? 'RULE_OVERLAP' : 'VALIDATION_FAILED', 'invalid settings', {
        issues: validation.issues,
      }),
      hasOverlap ? 409 : 400,
    );
  }

  await saveSettings(c.env.DB, validation.value);
  return c.json(maskSettings(validation.value));
});

adminRoutes.post('/settings/test-bark', async (c) => {
  const settings = await getSettings(c.env.DB);
  const deviceKey = await decryptSecret(settings.notify.bark.keyCipher, c.env.SECRET_KEY).catch(() => '');
  if (!deviceKey) return c.json(errorBody('BARK_KEY_MISSING', 'bark device key is not configured'), 400);

  const lang = settings.notifyLang ?? 'zh-CN';
  const started = Date.now();
  const result = await sendBark(
    {
      baseUrl: settings.notify.bark.baseUrl,
      deviceKey,
      group: settings.notify.bark.group,
      sound: settings.notify.bark.sound,
      level: settings.notify.bark.level,
      icon: settings.notify.bark.icon,
    },
    testMessage(lang),
  );

  await writeLog(
    c.env.DB,
    {
      runKey: `test:${crypto.randomUUID()}`,
      localDate: todayInTz(settings.tz),
      channel: 'bark',
      trigger: 'test',
      status: result.ok ? 'ok' : 'failed',
      itemCount: 0,
      title: testMessage(lang).title,
      body: testMessage(lang).body,
      httpStatus: result.httpStatus,
      elapsedMs: result.elapsedMs,
      attempts: 1,
      error: result.error,
      detail: { attempt: 1, ...result.detail },
    },
    new Date(started),
  );

  return c.json({
    ok: result.ok,
    httpStatus: result.httpStatus,
    elapsedMs: result.elapsedMs,
    error: result.error,
  });
});

adminRoutes.get('/logs', async (c) => {
  const status = c.req.query('status') ?? 'all';
  const from = c.req.query('from');
  const to = c.req.query('to');
  const page = readInt(c.req.query('page'), 1, 1, 10_000);
  const size = readInt(c.req.query('size'), 20, 1, 100);

  const where: string[] = [];
  const params: unknown[] = [];
  if (status === 'failed' || status === 'ok') {
    where.push('status = ?');
    params.push(status);
  }
  if (from) {
    where.push('local_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('local_date <= ?');
    params.push(to);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRow, list, stats] = await Promise.all([
    c.env.DB.prepare(`SELECT count(*) AS total FROM notify_log ${whereSql}`)
      .bind(...params)
      .first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT id, run_key, local_date, channel, trigger, status, item_count, title, body,
              http_status, elapsed_ms, attempts, error, detail, created_at
         FROM notify_log ${whereSql}
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, size, (page - 1) * size)
      .all<Record<string, unknown>>(),
    c.env.DB.prepare(
      `SELECT status, count(*) AS n FROM notify_log
        WHERE created_at >= ? GROUP BY status`,
    )
      .bind(new Date(Date.now() - 7 * 86_400_000).toISOString())
      .all<{ status: string; n: number }>(),
  ]);

  const statsMap: Record<string, number> = { ok: 0, failed: 0 };
  for (const row of stats.results) statsMap[row.status] = row.n;

  return c.json({
    items: list.results.map((row) => ({
      ...row,
      detail: typeof row.detail === 'string' ? safeJson(row.detail) : row.detail,
    })),
    total: countRow?.total ?? 0,
    page,
    size,
    stats7d: statsMap,
  });
});

adminRoutes.delete('/logs', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM notify_log').run();
  return c.json({ deleted: result.meta.changes ?? 0 });
});

adminRoutes.get('/export', async (c) => {
  const settings = await getSettings(c.env.DB);
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, note, due_date, is_public, is_done, done_at, done_by,
            notify_mode, notify_offsets, created_at, updated_at
       FROM reminders ORDER BY created_at ASC`,
  ).all<Record<string, unknown>>();

  const masked = maskSettings(settings);
  return c.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: masked,
    reminders: results,
  });
});

adminRoutes.post('/import', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { mode?: string; data?: { settings?: unknown; reminders?: unknown } }
    | null;
  if (!body?.data) return c.json(errorBody('BAD_JSON', 'invalid body'), 400);

  const mode = body.mode === 'replace' ? 'replace' : 'merge';
  const settingsPayload = body.data.settings;
  const remindersPayload = body.data.reminders;

  if (!Array.isArray(remindersPayload)) {
    return c.json(errorBody('VALIDATION_FAILED', 'reminders must be an array'), 400);
  }

  const now = new Date();
  let imported = 0;
  let skipped = 0;

  if (mode === 'replace') {
    await c.env.DB.prepare('DELETE FROM reminders').run();
  }

  for (const raw of remindersPayload) {
    const record = (raw ?? {}) as Record<string, unknown>;
    const validation = validateReminderInput({
      title: record.title,
      note: record.note ?? '',
      dueDate: record.due_date ?? record.dueDate,
      isPublic: record.is_public === 1 || record.isPublic === true,
      notifyMode: record.notify_mode ?? record.notifyMode ?? 'global',
      notifyOffsets:
        typeof record.notify_offsets === 'string'
          ? safeJson(record.notify_offsets)
          : (record.notifyOffsets ?? null),
    });
    if (!validation.ok || !validation.value) {
      skipped += 1;
      continue;
    }

    const input = validation.value;
    const id =
      typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 64
        ? record.id
        : crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO reminders (id, title, note, due_date, is_public, is_done, done_at, done_by,
                              notify_mode, notify_offsets, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title, note = excluded.note, due_date = excluded.due_date,
         is_public = excluded.is_public, notify_mode = excluded.notify_mode,
         notify_offsets = excluded.notify_offsets, updated_at = excluded.updated_at`,
    )
      .bind(
        id,
        input.title,
        input.note,
        input.dueDate,
        input.isPublic ? 1 : 0,
        record.is_done === 1 || record.isDone === true ? 1 : 0,
        typeof record.done_at === 'string' ? record.done_at : null,
        typeof record.done_by === 'string' ? record.done_by : null,
        input.notifyMode,
        input.notifyOffsets ? JSON.stringify(input.notifyOffsets) : null,
        typeof record.created_at === 'string' ? record.created_at : now.toISOString(),
        now.toISOString(),
      )
      .run();
    imported += 1;
  }

  if (settingsPayload) {
    const current = await getSettings(c.env.DB);
    const incoming = structuredClone(settingsPayload) as Record<string, unknown>;
    const notify = (incoming.notify ?? {}) as Record<string, unknown>;
    const bark = (notify.bark ?? {}) as Record<string, unknown>;
    delete bark.key;
    delete bark.clearKey;
    delete bark.hasKey;
    delete bark.keyCipher;
    bark.keyCipher = current.notify.bark.keyCipher;
    notify.bark = bark;
    incoming.notify = notify;

    const validation = validateSettingsPayload(incoming);
    if (validation.ok && validation.value) await saveSettings(c.env.DB, validation.value);
  }

  return c.json({ imported, skipped, mode });
});
