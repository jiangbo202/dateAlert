import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  tz: 'Asia/Shanghai',
  lang: 'auto',
  notifyLang: 'zh-CN',
  colors: {
    overdue: '#94A3B8',
    default: '#3B82F6',
    rules: [
      { id: 'r1', min: 0, max: 1, color: '#F59E0B', label: '即将到期' },
      { id: 'r2', min: 2, max: 7, color: '#10B981', label: '一周内' },
    ],
  },
  notify: {
    enabled: true,
    time: '08:00',
    offsets: [1, 3, 5],
    digest: { enabled: true, windowDays: 7 },
    bark: {
      enabled: true,
      baseUrl: 'https://api.day.app',
      keyCipher: '',
      group: 'date_alert',
      sound: 'bell',
      level: 'active',
      icon: '',
    },
  },
  display: {
    darkMode: 'auto',
  },
};

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 用 default 兜底深层合并，数组整体替换 */
export function mergeSettings(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch ?? base;
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = base[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? mergeSettings(current, value) : value;
  }
  return out;
}

/** 读取设置，缺行或缺字段时回落到默认值 */
export async function getSettings(db: D1Database): Promise<Settings> {
  const row = await db.prepare('SELECT json FROM settings WHERE id = 1').first<{ json: string }>();
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  try {
    return mergeSettings(structuredClone(DEFAULT_SETTINGS), JSON.parse(row.json)) as Settings;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(db: D1Database, settings: Settings): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (id, json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
    )
    .bind(JSON.stringify(settings), new Date().toISOString())
    .run();
}
