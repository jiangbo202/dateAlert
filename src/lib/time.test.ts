import { describe, expect, it } from 'vitest';
import { planRun, NOTIFY_WINDOW_MINUTES } from '../cron';
import { addDays, daysLeft, localTime, minutesOfDay, todayInTz } from './time';

describe('daysLeft', () => {
  it('同一天为 0', () => {
    expect(daysLeft('2026-11-09', '2026-11-09')).toBe(0);
  });
  it('明天为 1', () => {
    expect(daysLeft('2026-11-10', '2026-11-09')).toBe(1);
  });
  it('过去为负', () => {
    expect(daysLeft('2026-11-01', '2026-11-09')).toBe(-8);
  });
  it('跨年', () => {
    expect(daysLeft('2027-01-01', '2026-12-31')).toBe(1);
  });
  it('闰日', () => {
    expect(daysLeft('2024-03-01', '2024-02-28')).toBe(2);
    expect(daysLeft('2024-03-01', '2024-02-29')).toBe(1);
  });
  it('非闰年二月', () => {
    expect(daysLeft('2023-03-01', '2023-02-28')).toBe(1);
  });
});

describe('todayInTz', () => {
  it('按指定时区取日期', () => {
    const instant = new Date('2026-11-09T23:30:00Z');
    expect(todayInTz('UTC', instant)).toBe('2026-11-09');
    expect(todayInTz('Asia/Shanghai', instant)).toBe('2026-11-10');
    expect(todayInTz('America/New_York', instant)).toBe('2026-11-09');
  });
  it('UTC+14 与 UTC-11', () => {
    const instant = new Date('2026-11-09T11:00:00Z');
    expect(todayInTz('Pacific/Kiritimati', instant)).toBe('2026-11-10');
    expect(todayInTz('Pacific/Midway', instant)).toBe('2026-11-09');
  });
  it('小时归一化到 0..23', () => {
    const t = localTime('Asia/Shanghai', new Date('2026-11-09T16:00:00Z'));
    expect(t.hh).toBe(0);
    expect(t.mm).toBe(0);
    expect(t.date).toBe('2026-11-10');
  });
});

describe('addDays', () => {
  it('跨月与跨年', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('minutesOfDay', () => {
  it('解析 HH:MM', () => {
    expect(minutesOfDay('08:00')).toBe(480);
    expect(minutesOfDay('23:50')).toBe(1430);
  });
});

describe('planRun', () => {
  const tz = 'Asia/Shanghai';

  it('命中窗口起点', () => {
    // 上海 08:00
    const plan = planRun(tz, '08:00', new Date('2026-11-09T00:00:00Z'));
    expect(plan.inWindow).toBe(true);
    expect(plan.runKey).toBe('2026-11-09T08:00');
  });

  it('窗口内后续分钟仍然命中', () => {
    const plan = planRun(tz, '08:00', new Date('2026-11-09T00:29:00Z'));
    expect(plan.inWindow).toBe(true);
    expect(plan.runKey).toBe('2026-11-09T08:00');
  });

  it('窗口结束即不命中', () => {
    const plan = planRun(tz, '08:00', new Date('2026-11-09T00:30:00Z'));
    expect(plan.inWindow).toBe(false);
  });

  it('窗口之前不命中', () => {
    const plan = planRun(tz, '08:00', new Date('2026-11-08T23:59:00Z'));
    expect(plan.inWindow).toBe(false);
  });

  it('跨零点窗口归属前一天', () => {
    // 上海 11-10 23:55
    const before = planRun(tz, '23:50', new Date('2026-11-10T15:55:00Z'));
    expect(before.inWindow).toBe(true);
    expect(before.runKey).toBe('2026-11-10T23:50');

    // 上海 11-11 00:05，仍属于 11-10 的窗口
    const after = planRun(tz, '23:50', new Date('2026-11-10T16:05:00Z'));
    expect(after.inWindow).toBe(true);
    expect(after.schedDate).toBe('2026-11-10');
    expect(after.runKey).toBe('2026-11-10T23:50');
  });

  it('跨零点窗口结束后不命中', () => {
    // 上海 11-11 00:21
    const plan = planRun(tz, '23:50', new Date('2026-11-10T16:21:00Z'));
    expect(plan.inWindow).toBe(false);
  });

  it('窗口长度与常量一致', () => {
    expect(NOTIFY_WINDOW_MINUTES).toBe(30);
  });
});
