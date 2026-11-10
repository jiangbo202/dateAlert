import { api } from './client';

export interface ReminderItem {
  id: string;
  title: string;
  note: string;
  dueDate: string;
  daysLeft: number | null;
  color: string;
  label: string;
  labelKey: 'overdue' | 'fallback' | 'undated' | null;
  isPublic: boolean;
  isDone: boolean;
  doneBy: string | null;
  doneAt: string | null;
  notifyMode: 'global' | 'off' | 'custom';
  notifyOffsets: number[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderListResponse {
  items: ReminderItem[];
  total: number;
  page: number;
  size: number;
}

export interface ReminderPayload {
  title: string;
  note: string;
  dueDate: string;
  isPublic: boolean;
  notifyMode: 'global' | 'off' | 'custom';
  notifyOffsets: number[] | null;
}

export type ReminderScope = 'active' | 'archived' | 'undated' | 'all';

export async function listReminders(params: {
  scope: ReminderScope;
  q?: string;
  page?: number;
  size?: number;
}): Promise<ReminderListResponse> {
  const search = new URLSearchParams({
    scope: params.scope,
    page: String(params.page ?? 1),
    size: String(params.size ?? 20),
  });
  if (params.q) search.set('q', params.q);
  return api<ReminderListResponse>(`/api/admin/reminders?${search.toString()}`);
}

export async function getReminder(id: string): Promise<ReminderItem> {
  const data = await api<{ item: ReminderItem }>(`/api/admin/reminders/${id}`);
  return data.item;
}

export async function createReminder(payload: ReminderPayload): Promise<ReminderItem> {
  const data = await api<{ item: ReminderItem }>('/api/admin/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.item;
}

export async function updateReminder(id: string, payload: Partial<ReminderPayload>): Promise<ReminderItem> {
  const data = await api<{ item: ReminderItem }>(`/api/admin/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.item;
}

export async function archiveReminder(id: string): Promise<ReminderItem> {
  const data = await api<{ item: ReminderItem }>(`/api/admin/reminders/${id}/archive`, { method: 'POST' });
  return data.item;
}

export async function restoreReminder(id: string): Promise<ReminderItem> {
  const data = await api<{ item: ReminderItem }>(`/api/admin/reminders/${id}/restore`, { method: 'POST' });
  return data.item;
}

export async function deleteReminder(id: string): Promise<void> {
  await api(`/api/admin/reminders/${id}`, { method: 'DELETE' });
}

export async function purgeArchived(): Promise<number> {
  const data = await api<{ deleted: number }>('/api/admin/reminders/purge-archived', { method: 'POST' });
  return data.deleted;
}
