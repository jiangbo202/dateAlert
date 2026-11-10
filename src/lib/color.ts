import type { ColorRule } from '../types';

export interface ColorPalette {
  overdue: string;
  default: string;
  rules: ColorRule[];
}

export type StatusLabelKey = 'overdue' | 'fallback' | 'undated';

/** 无日期提醒的固定灰色 */
export const UNDATED_COLOR = '#64748B';

export interface ResolvedColor {
  color: string;
  label: string;
  labelKey: StatusLabelKey | null;
}

export const OVERDUE_LABEL = '已过期';
export const FALLBACK_LABEL = '计划中';
export const UNDATED_LABEL = '无日期';

export const MAX_RULES = 10;
export const MAX_LABEL_LENGTH = 20;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** 按剩余天数取规则色与标签；null 表示无日期 */
export function pickColor(daysLeft: number | null, palette: ColorPalette): ResolvedColor {
  if (daysLeft === null) return { color: UNDATED_COLOR, label: UNDATED_LABEL, labelKey: 'undated' };
  if (daysLeft < 0) return { color: palette.overdue, label: OVERDUE_LABEL, labelKey: 'overdue' };
  const hit = palette.rules.find((rule) => daysLeft >= rule.min && daysLeft <= rule.max);
  if (hit) return { color: hit.color, label: hit.label, labelKey: null };
  return { color: palette.default, label: FALLBACK_LABEL, labelKey: 'fallback' };
}

export interface RuleIssue {
  code:
    | 'RULES_TOO_MANY'
    | 'RULE_ID_INVALID'
    | 'RULE_ID_DUPLICATED'
    | 'RULE_RANGE_INVALID'
    | 'RULE_COLOR_INVALID'
    | 'RULE_LABEL_INVALID'
    | 'RULE_OVERLAP';
  ruleId?: string;
  message: string;
  conflict?: [string, string];
}

export interface RuleValidation {
  ok: boolean;
  issues: RuleIssue[];
  conflicts: Array<[string, string]>;
}

/** 校验颜色规则：数量、字段合法性、区间不重叠 */
export function validateColorRules(rules: ColorRule[]): RuleValidation {
  const issues: RuleIssue[] = [];
  const conflicts: Array<[string, string]> = [];

  if (!Array.isArray(rules)) {
    return {
      ok: false,
      issues: [{ code: 'RULES_TOO_MANY', message: 'rules must be an array' }],
      conflicts,
    };
  }

  if (rules.length > MAX_RULES) {
    issues.push({ code: 'RULES_TOO_MANY', message: `at most ${MAX_RULES} rules` });
  }

  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule || typeof rule.id !== 'string' || rule.id.trim() === '') {
      issues.push({ code: 'RULE_ID_INVALID', message: 'rule id is required' });
      continue;
    }
    if (seen.has(rule.id)) {
      issues.push({ code: 'RULE_ID_DUPLICATED', ruleId: rule.id, message: 'duplicated rule id' });
    }
    seen.add(rule.id);

    if (
      !Number.isInteger(rule.min) ||
      !Number.isInteger(rule.max) ||
      rule.min < 0 ||
      rule.max < 0 ||
      rule.min > rule.max
    ) {
      issues.push({
        code: 'RULE_RANGE_INVALID',
        ruleId: rule.id,
        message: 'require integers with 0 <= min <= max',
      });
    }

    if (typeof rule.color !== 'string' || !HEX_COLOR.test(rule.color)) {
      issues.push({ code: 'RULE_COLOR_INVALID', ruleId: rule.id, message: 'color must be hex' });
    }

    if (
      typeof rule.label !== 'string' ||
      rule.label.trim() === '' ||
      rule.label.trim().length > MAX_LABEL_LENGTH
    ) {
      issues.push({
        code: 'RULE_LABEL_INVALID',
        ruleId: rule.id,
        message: `label length must be 1-${MAX_LABEL_LENGTH}`,
      });
    }
  }

  const sorted = [...rules]
    .filter((rule) => Number.isInteger(rule?.min) && Number.isInteger(rule?.max) && rule.min <= rule.max)
    .sort((a, b) => a.min - b.min || a.max - b.max);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next.min <= current.max) {
      conflicts.push([current.id, next.id]);
      issues.push({
        code: 'RULE_OVERLAP',
        ruleId: next.id,
        conflict: [current.id, next.id],
        message: `range [${current.min},${current.max}] overlaps [${next.min},${next.max}]`,
      });
    }
  }

  return { ok: issues.length === 0, issues, conflicts };
}
