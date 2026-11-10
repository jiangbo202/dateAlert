export interface ValidationIssue {
  code: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 64;

/** 管理员密码规则：12–64 字符，同时包含字母与数字 */
export function validatePassword(password: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (typeof password !== 'string') {
    return { ok: false, issues: [{ code: 'VALIDATION_FAILED', field: 'password', message: 'password is required' }] };
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    issues.push({
      code: 'PASSWORD_LENGTH',
      field: 'password',
      message: `length must be ${PASSWORD_MIN}-${PASSWORD_MAX}`,
    });
  }
  if (!/[A-Za-z]/.test(password)) {
    issues.push({ code: 'PASSWORD_LETTER', field: 'password', message: 'must contain a letter' });
  }
  if (!/[0-9]/.test(password)) {
    issues.push({ code: 'PASSWORD_DIGIT', field: 'password', message: 'must contain a digit' });
  }
  return { ok: issues.length === 0, issues };
}

export const TITLE_MAX = 50;
export const NOTE_MAX = 200;
export const OFFSET_MAX = 365;
export const OFFSETS_LIMIT = 10;

export type NotifyMode = 'global' | 'off' | 'custom';

export interface ReminderInput {
  title: string;
  note: string;
  /** 空字符串表示不设置日期 */
  dueDate: string;
  isPublic: boolean;
  notifyMode: NotifyMode;
  notifyOffsets: number[] | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDueDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

export function normalizeOffsets(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const unique = new Set<number>();
  for (const item of value) {
    if (!Number.isInteger(item) || item < 0 || item > OFFSET_MAX) continue;
    unique.add(item as number);
  }
  return [...unique].sort((a, b) => a - b).slice(0, OFFSETS_LIMIT);
}

export interface ReminderValidation extends ValidationResult {
  value?: ReminderInput;
}

/** 提醒创建/编辑入参校验 */
export function validateReminderInput(raw: unknown): ReminderValidation {
  const issues: ValidationIssue[] = [];
  const body = (raw ?? {}) as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 1 || title.length > TITLE_MAX) {
    issues.push({ code: 'TITLE_INVALID', field: 'title', message: `length must be 1-${TITLE_MAX}` });
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > NOTE_MAX) {
    issues.push({ code: 'NOTE_INVALID', field: 'note', message: `length must be <= ${NOTE_MAX}` });
  }

  const rawDue = body.dueDate;
  const dueDate = rawDue === undefined || rawDue === null ? '' : rawDue;
  if (dueDate !== '' && !isValidDueDate(dueDate)) {
    issues.push({ code: 'DUE_DATE_INVALID', field: 'dueDate', message: 'must be YYYY-MM-DD or empty' });
  }

  const isPublic = body.isPublic === undefined ? true : body.isPublic === true;

  const notifyModeRaw = body.notifyMode ?? 'global';
  const notifyMode =
    notifyModeRaw === 'global' || notifyModeRaw === 'off' || notifyModeRaw === 'custom'
      ? notifyModeRaw
      : null;
  if (!notifyMode) {
    issues.push({ code: 'NOTIFY_MODE_INVALID', field: 'notifyMode', message: 'global|off|custom' });
  }

  let notifyOffsets: number[] | null = null;
  if (notifyMode === 'custom') {
    notifyOffsets = normalizeOffsets(body.notifyOffsets);
    if (!notifyOffsets || notifyOffsets.length === 0) {
      issues.push({
        code: 'NOTIFY_OFFSETS_INVALID',
        field: 'notifyOffsets',
        message: 'custom mode requires 0-365 integers',
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    issues: [],
    value: {
      title,
      note,
      dueDate: dueDate as string,
      isPublic,
      notifyMode: notifyMode as NotifyMode,
      notifyOffsets,
    },
  };
}
