import { describe, expect, it } from 'vitest';
import { selectHits, planRun } from './cron';
import type { Settings } from './types';

const baseSettings: Settings = {
  tz: 'Asia/Shanghai',
  lang: 'auto',
  notifyLang: 'zh-CN',
  colors: { overdue: '#94A3B8', default: '#3B82F6', rules: [] },
  notify: {
    enabled: true,
    time: '08:00',
    offsets: [1, 3, 5],
    digest: { enabled: false, windowDays: 7 },
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

const row = (patch: Record<string, unknown> = {}) => ({
  id: 'r1',
  title: '考试',
  due_date: '2026-11-10',
  notify_mode: 'global' as const,
  notify_offsets: null,
  ...patch,
});

describe('selectHits', () => {
  it('命中全局天数', () => {
    const hits = selectHits([row()], baseSettings, '2026-11-09');
    expect(hits).toEqual([{ id: 'r1', title: '考试', daysLeft: 1 }]);
  });

  it('未命中全局天数', () => {
    expect(selectHits([row({ due_date: '2026-11-11' })], baseSettings, '2026-11-09')).toEqual([]);
  });

  it('无日期不参与提醒', () => {
    expect(selectHits([row({ due_date: '' })], baseSettings, '2026-11-09')).toEqual([]);
  });

  it('已过期不参与', () => {
    expect(selectHits([row({ due_date: '2026-11-01' })], baseSettings, '2026-11-09')).toEqual([]);
  });

  it('off 模式不参与', () => {
    expect(selectHits([row({ notify_mode: 'off' })], baseSettings, '2026-11-09')).toEqual([]);
  });

  it('custom 模式用自己的天数', () => {
    const custom = row({ due_date: '2026-11-11', notify_mode: 'custom', notify_offsets: '[2]' });
    expect(selectHits([custom], baseSettings, '2026-11-09')).toHaveLength(1);
    expect(selectHits([custom], baseSettings, '2026-11-10')).toHaveLength(0);
  });

  it('custom 的损坏 JSON 视为不提醒', () => {
    const broken = row({ notify_mode: 'custom', notify_offsets: 'not-json' });
    expect(selectHits([broken], baseSettings, '2026-11-09')).toEqual([]);
  });

  it('digest 开启时覆盖窗口内所有天数', () => {
    const settings: Settings = {
      ...baseSettings,
      notify: { ...baseSettings.notify, digest: { enabled: true, windowDays: 7 } },
    };
    const hits = selectHits([row({ due_date: '2026-11-14' })], settings, '2026-11-09');
    expect(hits).toHaveLength(1);
  });

  it('digest 不覆盖窗口外', () => {
    const settings: Settings = {
      ...baseSettings,
      notify: { ...baseSettings.notify, digest: { enabled: true, windowDays: 7 } },
    };
    expect(selectHits([row({ due_date: '2026-11-17' })], settings, '2026-11-09')).toEqual([]);
  });

  it('当日到期（0 天）仅在配置包含 0 时提醒', () => {
    const withoutZero = selectHits([row({ due_date: '2026-11-09' })], baseSettings, '2026-11-09');
    expect(withoutZero).toHaveLength(0);

    const withZero: Settings = {
      ...baseSettings,
      notify: { ...baseSettings.notify, offsets: [0, 1, 3, 5] },
    };
    const hits = selectHits([row({ due_date: '2026-11-09' })], withZero, '2026-11-09');
    expect(hits[0].daysLeft).toBe(0);
  });

  it('同一提醒只出现一次（多种命中）', () => {
    const settings: Settings = {
      ...baseSettings,
      notify: { ...baseSettings.notify, digest: { enabled: true, windowDays: 7 } },
    };
    const hits = selectHits([row()], settings, '2026-11-09');
    expect(hits).toHaveLength(1);
  });

  it('按剩余天数升序', () => {
    const rows = [
      row({ id: 'a', due_date: '2026-11-14' }),
      row({ id: 'b', due_date: '2026-11-10' }),
      row({ id: 'c', due_date: '2026-11-12' }),
    ];
    // 1 天、3 天、5 天都命中，按剩余天数升序
    expect(selectHits(rows, baseSettings, '2026-11-09').map((hit) => hit.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('planRun 边界补充', () => {
  it('本地 00:00 时 minuteOfDay 为 0（触发清理）', () => {
    const plan = planRun('Asia/Shanghai', '08:00', new Date('2026-11-09T16:00:00Z'));
    expect(plan.minuteOfDay).toBe(0);
  });

  it('计划时间 00:00 时窗口覆盖 00:00–00:29', () => {
    expect(planRun('Asia/Shanghai', '00:00', new Date('2026-11-09T16:00:00Z')).inWindow).toBe(true);
    expect(planRun('Asia/Shanghai', '00:00', new Date('2026-11-09T16:29:00Z')).inWindow).toBe(true);
    expect(planRun('Asia/Shanghai', '00:00', new Date('2026-11-09T16:30:00Z')).inWindow).toBe(false);
  });
});
