import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { SettingsView } from '../composables/useSettings';

interface LogItem {
  id: number;
  run_key: string;
  local_date: string;
  channel: string;
  trigger: string;
  status: string;
  item_count: number;
  title: string | null;
  body: string | null;
  http_status: number | null;
  elapsed_ms: number | null;
  attempts: number;
  error: string | null;
  detail: unknown;
  created_at: string;
}

export function useSettingsPanels() {
  const timeZones = ref<string[]>([]);
  const nowTick = ref(new Date());
  let timer: number | undefined;

  function loadTimeZones(): void {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    try {
      const values = intl.supportedValuesOf?.('timeZone');
      timeZones.value = values?.length ? values : fallbackZones;
    } catch {
      timeZones.value = fallbackZones;
    }
  }

  const localNow = computed(() => nowTick.value);

  onMounted(() => {
    loadTimeZones();
    timer = window.setInterval(() => {
      nowTick.value = new Date();
    }, 1000);
  });

  onBeforeUnmount(() => window.clearInterval(timer));

  return { timeZones, localNow };
}

export function formatInZone(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

const fallbackZones = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

export async function testBarkPush(): Promise<{ ok: boolean; httpStatus: number | null; error: string | null }> {
  try {
    return await api('/api/admin/settings/test-bark', { method: 'POST' });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, httpStatus: null, error: err.code };
    return { ok: false, httpStatus: null, error: 'NETWORK_ERROR' };
  }
}

export async function fetchLogs(params: {
  status: 'all' | 'ok' | 'failed';
  page: number;
  size: number;
  from?: string;
  to?: string;
}): Promise<{ items: LogItem[]; total: number; page: number; size: number; stats7d: Record<string, number> }> {
  const search = new URLSearchParams({ status: params.status, page: String(params.page), size: String(params.size) });
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  return api(`/api/admin/logs?${search.toString()}`);
}

export async function clearLogs(): Promise<number> {
  const data = await api<{ deleted: number }>('/api/admin/logs', { method: 'DELETE' });
  return data.deleted;
}

export type { LogItem };

export function exportSettingsDraft(draft: SettingsView | null): void {
  void draft;
}
