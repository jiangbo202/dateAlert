import { describe, expect, it } from 'vitest';
import { decideArchival } from './reminders';

const now = new Date('2026-11-09T12:00:00Z');

describe('decideArchival', () => {
  it('未归档且未来 → 不变', () => {
    const result = decideArchival({ isDone: 0, doneBy: null, doneAt: null }, '2026-12-01', '2026-11-09', now);
    expect(result.changed).toBe(false);
    expect(result.isDone).toBe(0);
  });

  it('未归档且今天到期 → 不变', () => {
    const result = decideArchival({ isDone: 0, doneBy: null, doneAt: null }, '2026-11-09', '2026-11-09', now);
    expect(result.isDone).toBe(0);
  });

  it('未归档且已过期 → 自动归档', () => {
    const result = decideArchival({ isDone: 0, doneBy: null, doneAt: null }, '2026-11-01', '2026-11-09', now);
    expect(result).toMatchObject({ isDone: 1, doneBy: 'auto', changed: true });
    expect(result.doneAt).toBe(now.toISOString());
  });

  it('自动归档后改回未来 → 自动恢复', () => {
    const result = decideArchival(
      { isDone: 1, doneBy: 'auto', doneAt: '2026-11-02T00:00:00Z' },
      '2026-12-31',
      '2026-11-09',
      now,
    );
    expect(result).toMatchObject({ isDone: 0, doneBy: null, doneAt: null, changed: true });
  });

  it('手动归档后改日期 → 保持归档', () => {
    const result = decideArchival(
      { isDone: 1, doneBy: 'manual', doneAt: '2026-11-02T00:00:00Z' },
      '2026-12-31',
      '2026-11-09',
      now,
    );
    expect(result.changed).toBe(false);
    expect(result.isDone).toBe(1);
    expect(result.doneBy).toBe('manual');
  });

  it('无日期（空字符串）永不自动归档', () => {
    const result = decideArchival({ isDone: 0, doneBy: null, doneAt: null }, '', '2026-11-09', now);
    expect(result).toMatchObject({ isDone: 0, changed: false });
  });

  it('已归档且仍过期 → 不变', () => {
    const result = decideArchival(
      { isDone: 1, doneBy: 'auto', doneAt: '2026-11-02T00:00:00Z' },
      '2026-11-01',
      '2026-11-09',
      now,
    );
    expect(result.changed).toBe(false);
  });
});
