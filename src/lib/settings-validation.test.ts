import { describe, expect, it } from 'vitest';
import { isValidTimeZone, validateSettingsPayload } from './settings-validation';

const base = {
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
  display: { darkMode: 'auto' },
};

const withPatch = (patch: Record<string, unknown>) => ({ ...base, ...patch });

describe('isValidTimeZone', () => {
  it('接受合法时区', () => {
    expect(isValidTimeZone('Asia/Shanghai')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
  });
  it('拒绝非法值', () => {
    expect(isValidTimeZone('Mars/Phobos')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(123)).toBe(false);
  });
});

describe('validateSettingsPayload', () => {
  it('完整合法输入', () => {
    const result = validateSettingsPayload(base);
    expect(result.ok).toBe(true);
    expect(result.value?.colors.rules).toHaveLength(2);
    expect(result.value?.notify.offsets).toEqual([1, 3, 5]);
  });

  it('非法时区', () => {
    const result = validateSettingsPayload(withPatch({ tz: 'Nowhere/City' }));
    expect(result.issues.some((i) => i.code === 'TZ_INVALID')).toBe(true);
  });

  it('非法语言', () => {
    expect(validateSettingsPayload(withPatch({ lang: 'fr' })).issues[0].code).toBe('LANG_INVALID');
    expect(validateSettingsPayload(withPatch({ notifyLang: 'ja' })).issues[0].code).toBe('NOTIFY_LANG_INVALID');
  });

  it('非法时间格式', () => {
    const result = validateSettingsPayload({
      ...base,
      notify: { ...base.notify, time: '8:00' },
    });
    expect(result.issues.some((i) => i.code === 'TIME_INVALID')).toBe(true);
  });

  it('颜色规则重叠', () => {
    const result = validateSettingsPayload({
      ...base,
      colors: {
        ...base.colors,
        rules: [
          { id: 'a', min: 0, max: 3, color: '#F59E0B', label: 'A' },
          { id: 'b', min: 2, max: 7, color: '#10B981', label: 'B' },
        ],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'RULE_OVERLAP')).toBe(true);
  });

  it('非法颜色值', () => {
    const result = validateSettingsPayload({
      ...base,
      colors: { ...base.colors, overdue: 'gray' },
    });
    expect(result.issues.some((i) => i.code === 'COLOR_INVALID')).toBe(true);
  });

  it('digest 窗口越界', () => {
    const result = validateSettingsPayload({
      ...base,
      notify: { ...base.notify, digest: { enabled: true, windowDays: 99 } },
    });
    expect(result.issues.some((i) => i.code === 'DIGEST_WINDOW_INVALID')).toBe(true);
  });

  it('Bark 地址必须是 http(s)', () => {
    const result = validateSettingsPayload({
      ...base,
      notify: { ...base.notify, bark: { ...base.notify.bark, baseUrl: 'api.day.app' } },
    });
    expect(result.issues.some((i) => i.code === 'BARK_URL_INVALID')).toBe(true);
  });

  it('Bark 级别枚举', () => {
    const result = validateSettingsPayload({
      ...base,
      notify: { ...base.notify, bark: { ...base.notify.bark, level: 'loud' } },
    });
    expect(result.issues.some((i) => i.code === 'BARK_LEVEL_INVALID')).toBe(true);
  });

  it('归一化 offsets（去重、排序、过滤）', () => {
    const result = validateSettingsPayload({
      ...base,
      notify: { ...base.notify, offsets: [5, 1, 3, 3, 999] },
    });
    expect(result.value?.notify.offsets).toEqual([1, 3, 5]);
  });

  it('baseUrl 去尾部斜杠', () => {
    const result = validateSettingsPayload({
      ...base,
      notify: { ...base.notify, bark: { ...base.notify.bark, baseUrl: 'https://api.day.app/' } },
    });
    expect(result.value?.notify.bark.baseUrl).toBe('https://api.day.app');
  });

  it('缺失字段使用默认值', () => {
    const result = validateSettingsPayload({ tz: 'UTC' });
    expect(result.ok).toBe(true);
    expect(result.value?.notify.time).toBe('08:00');
    expect(result.value?.display.darkMode).toBe('auto');
  });
});
