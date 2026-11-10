import type { ColorPalette } from './color';
import { pickColor } from './color';
import { daysLeft, hasDueDate } from './time';
import type { ReminderRow } from '../types';

export interface ArchiveDecision {
  isDone: 0 | 1;
  doneBy: 'auto' | 'manual' | null;
  doneAt: string | null;
  changed: boolean;
}

/**
 * 归档状态决策：
 * - 未归档且已过期 → 自动归档
 * - 自动归档但已改回未来 → 自动恢复
 * - 手动归档保持归档，不自动恢复
 */
export function decideArchival(
  current: { isDone: number; doneBy: string | null; doneAt: string | null },
  dueDate: string,
  today: string,
  now: Date,
): ArchiveDecision {
  if (!hasDueDate(dueDate)) {
    return {
      isDone: (current.isDone === 1 ? 1 : 0) as 0 | 1,
      doneBy: current.doneBy as 'auto' | 'manual' | null,
      doneAt: current.doneAt,
      changed: false,
    };
  }
  const remaining = daysLeft(dueDate, today);
  const isDone = current.isDone === 1;
  const isManual = current.doneBy === 'manual';

  if (!isDone && remaining < 0) {
    return { isDone: 1, doneBy: 'auto', doneAt: now.toISOString(), changed: true };
  }

  if (isDone && !isManual && remaining >= 0) {
    return { isDone: 0, doneBy: null, doneAt: null, changed: true };
  }

  return { isDone: (isDone ? 1 : 0) as 0 | 1, doneBy: current.doneBy as 'auto' | 'manual' | null, doneAt: current.doneAt, changed: false };
}

export interface ReminderItem {
  id: string;
  title: string;
  note: string;
  dueDate: string;
  daysLeft: number | null;
  color: string;
  label: string;
  labelKey: 'overdue' | 'fallback' | null;
  isPublic: boolean;
  isDone: boolean;
  doneBy: string | null;
  doneAt: string | null;
  notifyMode: string;
  notifyOffsets: number[] | null;
  createdAt: string;
  updatedAt: string;
}

function parseOffsets(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

export function toReminderItem(row: ReminderRow, today: string, palette: ColorPalette): ReminderItem {
  const remaining = hasDueDate(row.due_date) ? daysLeft(row.due_date, today) : null;
  const { color, label, labelKey } = pickColor(remaining, palette);
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    dueDate: row.due_date,
    daysLeft: remaining,
    color,
    label,
    labelKey,
    isPublic: row.is_public === 1,
    isDone: row.is_done === 1,
    doneBy: row.done_by,
    doneAt: row.done_at,
    notifyMode: row.notify_mode,
    notifyOffsets: parseOffsets(row.notify_offsets),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
