export interface ColorRule {
  id: string;
  min: number;
  max: number;
  color: string;
  label: string;
}

export interface Palette {
  overdue: string;
  default: string;
  rules: ColorRule[];
}

export function pickColor(
  daysLeft: number,
  palette: Palette,
): { color: string; label: string; labelKey: 'overdue' | 'fallback' | null } {
  if (daysLeft < 0) return { color: palette.overdue, label: '已过期', labelKey: 'overdue' };
  const hit = palette.rules.find((rule) => daysLeft >= rule.min && daysLeft <= rule.max);
  if (hit) return { color: hit.color, label: hit.label, labelKey: null };
  return { color: palette.default, label: '计划中', labelKey: 'fallback' };
}

/** 返回第一对重叠的规则 id */
export function findOverlap(rules: ColorRule[]): [string, string] | null {
  const sorted = [...rules].sort((a, b) => a.min - b.min || a.max - b.max);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (sorted[i + 1].min <= sorted[i].max) return [sorted[i].id, sorted[i + 1].id];
  }
  return null;
}

export function isInvalidRule(rule: ColorRule): boolean {
  return (
    !Number.isInteger(rule.min) ||
    !Number.isInteger(rule.max) ||
    rule.min < 0 ||
    rule.max < 0 ||
    rule.min > rule.max ||
    !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rule.color) ||
    !rule.label.trim()
  );
}
