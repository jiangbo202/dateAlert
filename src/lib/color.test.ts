import { describe, expect, it } from 'vitest';
import {
  FALLBACK_LABEL,
  MAX_RULES,
  OVERDUE_LABEL,
  pickColor,
  validateColorRules,
  type ColorPalette,
} from './color';
import type { ColorRule } from '../types';

const palette: ColorPalette = {
  overdue: '#94A3B8',
  default: '#3B82F6',
  rules: [
    { id: 'r1', min: 0, max: 1, color: '#F59E0B', label: '即将到期' },
    { id: 'r2', min: 2, max: 7, color: '#10B981', label: '一周内' },
  ],
};

const rule = (patch: Partial<ColorRule> = {}): ColorRule => ({
  id: 'r',
  min: 0,
  max: 1,
  color: '#F59E0B',
  label: '即将到期',
  ...patch,
});

describe('pickColor', () => {
  it('区间下界命中', () => {
    expect(pickColor(0, palette)).toEqual({ color: '#F59E0B', label: '即将到期', labelKey: null });
  });
  it('区间上界命中（闭区间）', () => {
    expect(pickColor(1, palette)).toEqual({ color: '#F59E0B', label: '即将到期', labelKey: null });
    expect(pickColor(7, palette)).toEqual({ color: '#10B981', label: '一周内', labelKey: null });
  });
  it('相邻区间起点命中第二条', () => {
    expect(pickColor(2, palette).color).toBe('#10B981');
  });
  it('超出所有区间用默认色', () => {
    expect(pickColor(8, palette)).toEqual({ color: '#3B82F6', label: FALLBACK_LABEL, labelKey: 'fallback' });
    expect(pickColor(365, palette).color).toBe('#3B82F6');
  });
  it('已过期用过期色', () => {
    expect(pickColor(-1, palette)).toEqual({ color: '#94A3B8', label: OVERDUE_LABEL, labelKey: 'overdue' });
    expect(pickColor(-365, palette).label).toBe(OVERDUE_LABEL);
  });
  it('无日期使用固定灰色与 undated 标签', () => {
    expect(pickColor(null, palette)).toEqual({ color: '#64748B', label: '无日期', labelKey: 'undated' });
  });

  it('规则为空时全部走默认色', () => {
    const empty: ColorPalette = { overdue: '#94A3B8', default: '#3B82F6', rules: [] };
    expect(pickColor(0, empty).color).toBe('#3B82F6');
    expect(pickColor(99, empty).label).toBe(FALLBACK_LABEL);
  });
  it('规则乱序时仍按区间命中', () => {
    const shuffled: ColorPalette = {
      ...palette,
      rules: [palette.rules[1], palette.rules[0]],
    };
    expect(pickColor(1, shuffled).color).toBe('#F59E0B');
    expect(pickColor(3, shuffled).color).toBe('#10B981');
  });
});

describe('validateColorRules', () => {
  it('默认规则合法', () => {
    const result = validateColorRules(palette.rules);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('相邻但不重叠合法', () => {
    const result = validateColorRules([
      rule({ id: 'a', min: 0, max: 1 }),
      rule({ id: 'b', min: 2, max: 7 }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('单点区间合法', () => {
    expect(validateColorRules([rule({ id: 'a', min: 0, max: 0 })]).ok).toBe(true);
  });

  it('重叠被拒绝并给出冲突对', () => {
    const result = validateColorRules([
      rule({ id: 'a', min: 0, max: 3 }),
      rule({ id: 'b', min: 2, max: 7 }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.conflicts).toEqual([['a', 'b']]);
    expect(result.issues.map((i) => i.code)).toContain('RULE_OVERLAP');
  });

  it('完全包含也算重叠', () => {
    const result = validateColorRules([
      rule({ id: 'a', min: 0, max: 10 }),
      rule({ id: 'b', min: 3, max: 5 }),
    ]);
    expect(result.conflicts).toEqual([['a', 'b']]);
  });

  it('三条规则中的部分重叠', () => {
    const result = validateColorRules([
      rule({ id: 'a', min: 0, max: 1 }),
      rule({ id: 'b', min: 2, max: 5 }),
      rule({ id: 'c', min: 5, max: 9 }),
    ]);
    expect(result.conflicts).toEqual([['b', 'c']]);
  });

  it('min 大于 max 被拒绝', () => {
    const result = validateColorRules([rule({ min: 5, max: 2 })]);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('RULE_RANGE_INVALID');
  });

  it('负数与小数被拒绝', () => {
    expect(validateColorRules([rule({ min: -1, max: 2 })]).issues[0].code).toBe('RULE_RANGE_INVALID');
    expect(validateColorRules([rule({ min: 0, max: 1.5 })]).issues[0].code).toBe('RULE_RANGE_INVALID');
  });

  it('颜色格式非法被拒绝', () => {
    expect(validateColorRules([rule({ color: 'red' })]).issues[0].code).toBe('RULE_COLOR_INVALID');
    expect(validateColorRules([rule({ color: '#12345' })]).issues[0].code).toBe('RULE_COLOR_INVALID');
    expect(validateColorRules([rule({ color: '#abc' })]).ok).toBe(true);
  });

  it('标签为空或超长被拒绝', () => {
    expect(validateColorRules([rule({ label: '  ' })]).issues[0].code).toBe('RULE_LABEL_INVALID');
    expect(validateColorRules([rule({ label: '一'.repeat(21) })]).issues[0].code).toBe('RULE_LABEL_INVALID');
  });

  it('id 重复被拒绝', () => {
    const result = validateColorRules([rule({ id: 'a', max: 1 }), rule({ id: 'a', min: 5, max: 6 })]);
    expect(result.issues.map((i) => i.code)).toContain('RULE_ID_DUPLICATED');
  });

  it('数量超过上限被拒绝', () => {
    const rules = Array.from({ length: MAX_RULES + 1 }, (_, i) =>
      rule({ id: `r${i}`, min: i * 2, max: i * 2 + 1 }),
    );
    expect(validateColorRules(rules).issues.map((i) => i.code)).toContain('RULES_TOO_MANY');
  });

  it('空数组合法', () => {
    expect(validateColorRules([]).ok).toBe(true);
  });
});
