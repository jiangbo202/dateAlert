import { describe, expect, it } from 'vitest';
import {
  isValidDueDate,
  normalizeOffsets,
  PASSWORD_MAX,
  PASSWORD_MIN,
  validatePassword,
  validateReminderInput,
} from './validation';

describe('validatePassword', () => {
  it('合法密码', () => {
    expect(validatePassword('abcdef123456').ok).toBe(true);
    expect(validatePassword('A1' + 'x'.repeat(10)).ok).toBe(true);
  });
  it('过短与过长', () => {
    expect(validatePassword('a1'.repeat(5) + 'a').issues[0].code).toBe('PASSWORD_LENGTH');
    expect(validatePassword('a1' + 'x'.repeat(PASSWORD_MAX)).issues[0].code).toBe('PASSWORD_LENGTH');
    expect(validatePassword('a1' + 'x'.repeat(PASSWORD_MAX - 2)).ok).toBe(true);
    expect(validatePassword('a1' + 'x'.repeat(PASSWORD_MIN - 3)).issues[0].code).toBe('PASSWORD_LENGTH');
  });
  it('必须包含字母与数字', () => {
    expect(validatePassword('123456789012').issues.map((i) => i.code)).toContain('PASSWORD_LETTER');
    expect(validatePassword('abcdefghijkl').issues.map((i) => i.code)).toContain('PASSWORD_DIGIT');
  });
  it('非字符串被拒绝', () => {
    expect(validatePassword(undefined).ok).toBe(false);
    expect(validatePassword(123456789012).ok).toBe(false);
  });
});

describe('isValidDueDate', () => {
  it('接受合法日期', () => {
    expect(isValidDueDate('2026-11-09')).toBe(true);
    expect(isValidDueDate('2024-02-29')).toBe(true);
  });
  it('拒绝非法格式与不存在的日期', () => {
    expect(isValidDueDate('2026-11-9')).toBe(false);
    expect(isValidDueDate('2026/11/09')).toBe(false);
    expect(isValidDueDate('2023-02-29')).toBe(false);
    expect(isValidDueDate('2026-13-01')).toBe(false);
    expect(isValidDueDate(20261109)).toBe(false);
  });
});

describe('normalizeOffsets', () => {
  it('去重并升序', () => {
    expect(normalizeOffsets([5, 1, 3, 3])).toEqual([1, 3, 5]);
  });
  it('过滤越界与非法值', () => {
    expect(normalizeOffsets([-1, 0, 366, 1.5, '3', 7])).toEqual([0, 7]);
  });
  it('最多保留 10 个', () => {
    const result = normalizeOffsets(Array.from({ length: 20 }, (_, i) => i));
    expect(result).toHaveLength(10);
  });
  it('非数组返回 null', () => {
    expect(normalizeOffsets('1,2')).toBeNull();
    expect(normalizeOffsets(null)).toBeNull();
  });
});

describe('validateReminderInput', () => {
  const base = {
    title: '科目1考试',
    note: '考试理论',
    dueDate: '2026-12-09',
    isPublic: true,
    notifyMode: 'global',
  };

  it('合法输入', () => {
    const result = validateReminderInput(base);
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ title: '科目1考试', notifyMode: 'global', notifyOffsets: null });
  });

  it('标题去空格并校验长度', () => {
    expect(validateReminderInput({ ...base, title: '  考试  ' }).value?.title).toBe('考试');
    expect(validateReminderInput({ ...base, title: '  ' }).ok).toBe(false);
    expect(validateReminderInput({ ...base, title: '一'.repeat(51) }).issues[0].code).toBe('TITLE_INVALID');
  });

  it('备注超长被拒绝', () => {
    expect(validateReminderInput({ ...base, note: '一'.repeat(201) }).issues[0].code).toBe('NOTE_INVALID');
  });

  it('日期非法被拒绝', () => {
    expect(validateReminderInput({ ...base, dueDate: '2026-02-30' }).issues[0].code).toBe('DUE_DATE_INVALID');
  });

  it('到期日可省略（无日期提醒）', () => {
    expect(validateReminderInput({ ...base, dueDate: '' }).ok).toBe(true);
    expect(validateReminderInput({ ...base, dueDate: undefined }).ok).toBe(true);
    expect(validateReminderInput({ ...base, dueDate: undefined }).value?.dueDate).toBe('');
  });

  it('custom 模式必须有天数', () => {
    expect(validateReminderInput({ ...base, notifyMode: 'custom' }).ok).toBe(false);
    const ok = validateReminderInput({ ...base, notifyMode: 'custom', notifyOffsets: [1, 3] });
    expect(ok.value?.notifyOffsets).toEqual([1, 3]);
  });

  it('非 custom 模式忽略天数', () => {
    const result = validateReminderInput({ ...base, notifyOffsets: [1, 3] });
    expect(result.value?.notifyOffsets).toBeNull();
  });

  it('把 custom 空数组归一化为失败', () => {
    expect(validateReminderInput({ ...base, notifyMode: 'custom', notifyOffsets: [] }).ok).toBe(false);
  });

  it('非法 notifyMode 被拒绝', () => {
    expect(validateReminderInput({ ...base, notifyMode: 'sometimes' }).issues[0].code).toBe('NOTIFY_MODE_INVALID');
  });

  it('isPublic 默认为 true', () => {
    const { isPublic, ...withoutPublic } = base;
    expect(validateReminderInput(withoutPublic).value?.isPublic).toBe(true);
    expect(validateReminderInput({ ...base, isPublic: false }).value?.isPublic).toBe(false);
  });
});
