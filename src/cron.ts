import type { Env, ReminderRow, Settings } from './types';
import { getSettings } from './lib/settings';
import { addDays, daysLeft, hasDueDate, localTime, minutesOfDay } from './lib/time';
import { decryptSecret } from './lib/crypto';
import { sendBark } from './lib/bark';
import { buildPushMessage } from './lib/i18n.server';

export const NOTIFY_WINDOW_MINUTES = 30;
export const MAX_ATTEMPTS = 3;

export interface CronPlan {
  date: string;
  minuteOfDay: number;
  schedDate: string;
  schedMinute: number;
  inWindow: boolean;
  runKey: string;
}

/**
 * 判定当前时刻是否落在计划时间的推送窗口内，并给出 run_key。
 * 跨零点的窗口归属"计划时间所在的日期"。
 */
export function planRun(tz: string, notifyTime: string, now: Date): CronPlan {
  const t = localTime(tz, now);
  const schedMinute = minutesOfDay(notifyTime);
  const minuteOfDay = t.hh * 60 + t.mm;
  const crossMidnight = minuteOfDay < schedMinute;
  const schedDate = crossMidnight ? addDays(t.date, -1) : t.date;
  const normalized = crossMidnight ? minuteOfDay + 1440 : minuteOfDay;

  return {
    date: t.date,
    minuteOfDay,
    schedDate,
    schedMinute,
    inWindow: normalized >= schedMinute && normalized < schedMinute + NOTIFY_WINDOW_MINUTES,
    runKey: `${schedDate}T${notifyTime}`,
  };
}

export interface Hit {
  id: string;
  title: string;
  daysLeft: number;
}

type HitRow = Pick<ReminderRow, 'id' | 'title' | 'due_date' | 'notify_mode' | 'notify_offsets'>;

function parseOffsets(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** 收集当日命中提醒（纯函数，便于单测） */
export function selectHits(rows: HitRow[], settings: Settings, today: string): Hit[] {
  const hits = new Map<string, Hit>();
  const digest = settings.notify.digest;

  for (const row of rows) {
    if (!hasDueDate(row.due_date)) continue;
    const remaining = daysLeft(row.due_date, today);
    if (remaining < 0) continue;

    let matched = false;
    if (row.notify_mode === 'global') {
      matched = settings.notify.offsets.includes(remaining);
    } else if (row.notify_mode === 'custom') {
      matched = parseOffsets(row.notify_offsets).includes(remaining);
    }

    if (!matched && digest.enabled && remaining <= digest.windowDays) matched = true;
    if (matched) hits.set(row.id, { id: row.id, title: row.title, daysLeft: remaining });
  }

  return [...hits.values()].sort((a, b) => a.daysLeft - b.daysLeft || a.id.localeCompare(b.id));
}

/** 归档已过期提醒，幂等 */
export async function archiveExpired(db: D1Database, today: string, now: Date): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE reminders SET is_done = 1, done_at = ?, done_by = 'auto'
        WHERE is_done = 0 AND due_date <> '' AND due_date < ?`,
    )
    .bind(now.toISOString(), today)
    .run();
  return result.meta.changes ?? 0;
}

/** 仅在本地分钟为 00 时执行 */
export async function cleanup(db: D1Database, now: Date): Promise<void> {
  const iso = now.toISOString();
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(iso).run();
  await db
    .prepare('DELETE FROM login_attempts WHERE ts < ?')
    .bind(new Date(now.getTime() - 30 * 86_400_000).toISOString())
    .run();
  await db
    .prepare('DELETE FROM notify_log WHERE created_at < ?')
    .bind(new Date(now.getTime() - 90 * 86_400_000).toISOString())
    .run();
  await db
    .prepare('DELETE FROM notify_log WHERE id NOT IN (SELECT id FROM notify_log ORDER BY id DESC LIMIT 1000)')
    .run();
}

interface LogEntry {
  runKey: string;
  localDate: string;
  channel: 'bark' | 'internal';
  trigger: 'cron' | 'test';
  status: 'ok' | 'failed';
  itemCount: number;
  title: string | null;
  body: string | null;
  httpStatus: number | null;
  elapsedMs: number | null;
  attempts: number;
  error: string | null;
  detail: unknown;
}

export async function writeLog(db: D1Database, entry: LogEntry, now: Date): Promise<void> {
  const iso = now.toISOString();
  await db
    .prepare(
      `INSERT INTO notify_log (run_key, local_date, channel, trigger, status, item_count, title, body,
                               http_status, elapsed_ms, attempts, error, detail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(run_key, channel) DO UPDATE SET
         status = excluded.status,
         item_count = excluded.item_count,
         title = excluded.title,
         body = excluded.body,
         http_status = excluded.http_status,
         elapsed_ms = excluded.elapsed_ms,
         attempts = excluded.attempts,
         error = excluded.error,
         detail = excluded.detail,
         updated_at = excluded.updated_at`,
    )
    .bind(
      entry.runKey,
      entry.localDate,
      entry.channel,
      entry.trigger,
      entry.status,
      entry.itemCount,
      entry.title,
      entry.body,
      entry.httpStatus,
      entry.elapsedMs,
      entry.attempts,
      entry.error,
      entry.detail ? JSON.stringify(entry.detail) : null,
      iso,
      iso,
    )
    .run();
}

/** 定时任务入口 */
export async function runCron(env: Env, now: Date = new Date()): Promise<void> {
  try {
    await runCronInner(env, now);
  } catch (err) {
    const error = err as Error;
    console.error(JSON.stringify({ level: 'error', msg: 'cron failed', message: error.message }));
    try {
      const settings = await getSettings(env.DB);
      const plan = planRun(settings.tz, settings.notify.time, now);
      await writeLog(
        env.DB,
        {
          runKey: `error:${now.toISOString()}`,
          localDate: plan.date,
          channel: 'internal',
          trigger: 'cron',
          status: 'failed',
          itemCount: 0,
          title: null,
          body: null,
          httpStatus: null,
          elapsedMs: null,
          attempts: 1,
          error: error.message,
          detail: { error: { name: error.name, message: error.message, stack: (error.stack ?? '').slice(0, 2000) } },
        },
        now,
      );
    } catch {
      // 记录失败时不再抛出
    }
  }
}

async function runCronInner(env: Env, now: Date): Promise<void> {
  const settings = await getSettings(env.DB);
  const plan = planRun(settings.tz, settings.notify.time, now);

  const archived = await archiveExpired(env.DB, plan.date, now);
  if (plan.minuteOfDay === 0) await cleanup(env.DB, now);

  const enabled = settings.notify.enabled && settings.notify.bark.enabled;
  if (!enabled || !plan.inWindow) {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'cron tick',
        date: plan.date,
        archived,
        inWindow: plan.inWindow,
        enabled,
      }),
    );
    return;
  }

  const deviceKey = await decryptSecret(settings.notify.bark.keyCipher, env.SECRET_KEY).catch(() => '');
  if (!deviceKey) {
    // 配置不全也要留痕，便于在「执行日志」里看到为什么没发
    await writeLog(
      env.DB,
      {
        runKey: plan.runKey,
        localDate: plan.date,
        channel: 'internal',
        trigger: 'cron',
        status: 'failed',
        itemCount: 0,
        title: null,
        body: null,
        httpStatus: null,
        elapsedMs: null,
        attempts: 1,
        error: 'BARK_KEY_MISSING',
        detail: {
          reason: 'BARK_KEY_MISSING',
          hint: '系统管理 → 提醒设置 → 填写 Bark Device Key 后保存',
          inWindow: plan.inWindow,
          notifyEnabled: settings.notify.enabled,
          barkEnabled: settings.notify.bark.enabled,
        },
      },
      now,
    );
    console.log(JSON.stringify({ level: 'warn', msg: 'cron skipped: bark key missing', runKey: plan.runKey }));
    return;
  }

  const previous = await env.DB.prepare(
    'SELECT status, attempts FROM notify_log WHERE run_key = ? AND channel = ?',
  )
    .bind(plan.runKey, 'bark')
    .first<{ status: string; attempts: number }>();

  if (previous?.status === 'ok') return;
  const attemptsSoFar = previous?.attempts ?? 0;
  if (attemptsSoFar >= MAX_ATTEMPTS) return;

  const { results } = await env.DB.prepare(
    `SELECT id, title, due_date, notify_mode, notify_offsets
       FROM reminders WHERE is_done = 0`,
  ).all<HitRow>();

  const hits = selectHits(results, settings, plan.date);
  if (hits.length === 0) return;

  const lang = settings.notifyLang ?? 'zh-CN';
  const message = buildPushMessage(lang, hits.map((hit) => ({ title: hit.title, daysLeft: hit.daysLeft })));

  // 每次 cron 只尝试一次；失败由窗口内的后续分钟继续重试，累计达 MAX_ATTEMPTS 停止
  const last = await sendBark(
    {
      baseUrl: settings.notify.bark.baseUrl,
      deviceKey,
      group: settings.notify.bark.group,
      sound: settings.notify.bark.sound,
      level: settings.notify.bark.level,
      icon: settings.notify.bark.icon,
    },
    message,
  );

  const attempts = attemptsSoFar + 1;
  await writeLog(
    env.DB,
    {
      runKey: plan.runKey,
      localDate: plan.date,
      channel: 'bark',
      trigger: 'cron',
      status: last.ok ? 'ok' : 'failed',
      itemCount: hits.length,
      title: message.title,
      body: message.body,
      httpStatus: last.httpStatus,
      elapsedMs: last.elapsedMs,
      attempts,
      error: last.error,
      detail: { attempt: attempts, ...last.detail },
    },
    now,
  );

  console.log(
    JSON.stringify({
      level: last.ok ? 'info' : 'error',
      msg: last.ok ? 'push sent' : 'push failed',
      runKey: plan.runKey,
      items: hits.length,
      attempts,
      status: last.httpStatus,
    }),
  );
}
