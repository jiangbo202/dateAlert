import { Hono } from 'hono';
import type { Env } from '../types';
import { getSettings } from '../lib/settings';
import { pickColor } from '../lib/color';
import { daysLeft, hasDueDate, todayInTz } from '../lib/time';

export const publicRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

function readInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  const truncated = Math.trunc(value);
  if (truncated < min) return fallback;
  return Math.min(truncated, max);
}

publicRoutes.get('/reminders', async (c) => {
  const settings = await getSettings(c.env.DB);
  const today = todayInTz(settings.tz);

  const limit = readInt(c.req.query('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = readInt(c.req.query('offset'), 0, 0, 100_000);

  const [countRow, list] = await Promise.all([
    c.env.DB.prepare('SELECT count(*) AS total FROM reminders WHERE is_public = 1 AND is_done = 0').first<{
      total: number;
    }>(),
    c.env.DB.prepare(
      `SELECT id, title, note, due_date, created_at
         FROM reminders
        WHERE is_public = 1 AND is_done = 0
        ORDER BY CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date ASC, created_at DESC
        LIMIT ? OFFSET ?`,
    )
      .bind(limit, offset)
      .all<{ id: string; title: string; note: string; due_date: string; created_at: string }>(),
  ]);

  const items = list.results.map((row) => {
    const remaining = hasDueDate(row.due_date) ? daysLeft(row.due_date, today) : null;
    const { color, label, labelKey } = pickColor(remaining, settings.colors);
    return {
      id: row.id,
      title: row.title,
      note: row.note,
      dueDate: row.due_date,
      daysLeft: remaining,
      color,
      label,
      labelKey,
    };
  });

  return c.json({
    today,
    tz: settings.tz,
    total: countRow?.total ?? items.length,
    limit,
    offset,
    lang: settings.lang,
    items,
  });
});
