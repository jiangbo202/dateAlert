import type { ColorRule, Settings } from '../types';
import { validateColorRules } from './color';
import { normalizeOffsets } from './validation';

export interface SettingsIssue {
  code: string;
  field: string;
  message: string;
}

export interface SettingsValidation {
  ok: boolean;
  issues: SettingsIssue[];
  value: Settings | null;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const LANGS = ['auto', 'zh-CN', 'zh-TW', 'en'];
const NOTIFY_LANGS = ['zh-CN', 'zh-TW', 'en'];
const DARK_MODES = ['auto', 'light', 'dark'];
const LEVELS = ['active', 'timeSensitive', 'passive', 'critical'];

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 校验并归一化完整设置。入参为前端提交的完整对象，
 * `keyCipher` 由调用方处理（明文 key 单独加密后再合并）。
 */
export function validateSettingsPayload(raw: unknown): SettingsValidation {
  const issues: SettingsIssue[] = [];
  const body = (raw ?? {}) as Record<string, unknown>;

  const tz = body.tz;
  if (!isValidTimeZone(tz)) {
    issues.push({ code: 'TZ_INVALID', field: 'tz', message: 'invalid IANA time zone' });
  }

  const lang = body.lang ?? 'auto';
  if (!LANGS.includes(lang as string)) {
    issues.push({ code: 'LANG_INVALID', field: 'lang', message: 'unsupported language' });
  }

  const notifyLang = body.notifyLang ?? 'zh-CN';
  if (!NOTIFY_LANGS.includes(notifyLang as string)) {
    issues.push({ code: 'NOTIFY_LANG_INVALID', field: 'notifyLang', message: 'unsupported language' });
  }

  const colors = (body.colors ?? {}) as Record<string, unknown>;
  const overdue = colors.overdue ?? '#94A3B8';
  const fallback = colors.default ?? '#3B82F6';
  if (typeof overdue !== 'string' || !HEX.test(overdue)) {
    issues.push({ code: 'COLOR_INVALID', field: 'colors.overdue', message: 'hex color required' });
  }
  if (typeof fallback !== 'string' || !HEX.test(fallback)) {
    issues.push({ code: 'COLOR_INVALID', field: 'colors.default', message: 'hex color required' });
  }

  const rules = (colors.rules ?? []) as ColorRule[];
  const ruleValidation = validateColorRules(rules);
  if (!ruleValidation.ok) {
    for (const issue of ruleValidation.issues) {
      issues.push({
        code: issue.code,
        field: 'colors.rules',
        message: issue.message,
      });
    }
  }

  const notify = (body.notify ?? {}) as Record<string, unknown>;
  const time = notify.time ?? '08:00';
  if (typeof time !== 'string' || !TIME.test(time)) {
    issues.push({ code: 'TIME_INVALID', field: 'notify.time', message: 'HH:MM required' });
  }

  const offsets = normalizeOffsets(notify.offsets ?? [1, 3, 5]) ?? [];

  const digest = (notify.digest ?? {}) as Record<string, unknown>;
  const windowDays = Number(digest.windowDays ?? 7);
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 30) {
    issues.push({ code: 'DIGEST_WINDOW_INVALID', field: 'notify.digest.windowDays', message: '1-30' });
  }

  const bark = (notify.bark ?? {}) as Record<string, unknown>;
  if (!isHttpUrl(bark.baseUrl ?? 'https://api.day.app')) {
    issues.push({ code: 'BARK_URL_INVALID', field: 'notify.bark.baseUrl', message: 'http(s) url required' });
  }
  if (!LEVELS.includes((bark.level ?? 'active') as string)) {
    issues.push({ code: 'BARK_LEVEL_INVALID', field: 'notify.bark.level', message: 'unsupported level' });
  }
  const group = String(bark.group ?? 'date_alert');
  if (group.length > 30) {
    issues.push({ code: 'BARK_GROUP_INVALID', field: 'notify.bark.group', message: '<= 30 chars' });
  }
  const sound = String(bark.sound ?? 'bell');
  if (sound.length > 30) {
    issues.push({ code: 'BARK_SOUND_INVALID', field: 'notify.bark.sound', message: '<= 30 chars' });
  }
  const icon = String(bark.icon ?? '');
  if (icon && !isHttpUrl(icon)) {
    issues.push({ code: 'BARK_ICON_INVALID', field: 'notify.bark.icon', message: 'http(s) url required' });
  }

  const display = (body.display ?? {}) as Record<string, unknown>;
  const darkMode = display.darkMode ?? 'auto';
  if (!DARK_MODES.includes(darkMode as string)) {
    issues.push({ code: 'DARK_MODE_INVALID', field: 'display.darkMode', message: 'auto|light|dark' });
  }

  if (issues.length > 0) return { ok: false, issues, value: null };

  const value: Settings = {
    tz: tz as string,
    lang: lang as Settings['lang'],
    notifyLang: notifyLang as Settings['notifyLang'],
    colors: {
      overdue: overdue as string,
      default: fallback as string,
      rules: (rules ?? []).map((rule) => ({
        id: String(rule.id),
        min: Number(rule.min),
        max: Number(rule.max),
        color: String(rule.color),
        label: String(rule.label).trim(),
      })),
    },
    notify: {
      enabled: notify.enabled !== false,
      time: time as string,
      offsets,
      digest: { enabled: digest.enabled !== false, windowDays },
      bark: {
        enabled: bark.enabled !== false,
        baseUrl: String(bark.baseUrl ?? 'https://api.day.app').replace(/\/+$/, ''),
        keyCipher: String(bark.keyCipher ?? ''),
        group,
        sound,
        level: (bark.level ?? 'active') as Settings['notify']['bark']['level'],
        icon,
      },
    },
    display: {
      darkMode: darkMode as Settings['display']['darkMode'],
    },
  };

  return { ok: true, issues: [], value };
}
