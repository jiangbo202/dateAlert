import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { initLocale } from '../i18n';

export interface PublicItem {
  id: string;
  title: string;
  note: string;
  dueDate: string;
  daysLeft: number | null;
  color: string;
  label: string;
  labelKey: 'overdue' | 'fallback' | 'undated' | null;
}

export interface PublicPayload {
  today: string;
  tz: string;
  total: number;
  undated: number;
  limit: number;
  offset: number;
  lang?: string;
  items: PublicItem[];
}

const PAGE_SIZE = 60;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function todayInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(new Date());
  }
}

export function usePublicReminders() {
  const items = ref<PublicItem[]>([]);
  const total = ref(0);
  const today = ref('');
  const tz = ref('Asia/Shanghai');
  const lang = ref<string>('');
  const loading = ref(true);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const lastLoadedAt = ref(0);

  const hasMore = computed(() => items.value.length < total.value);

  async function request(offset: number, append: boolean): Promise<void> {
    const res = await fetch(`/api/public/reminders?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as PublicPayload;
    total.value = payload.total;
    today.value = payload.today;
    tz.value = payload.tz;
    lang.value = payload.lang ?? '';
    initLocale(payload.lang && payload.lang !== 'auto' ? payload.lang : undefined);
    items.value = append ? [...items.value, ...payload.items] : payload.items;
    lastLoadedAt.value = Date.now();
  }

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await request(0, false);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    try {
      await request(items.value.length, true);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loadingMore.value = false;
    }
  }

  /** 日期变化或长时间停留时静默刷新 */
  function refreshIfStale(): void {
    if (document.visibilityState !== 'visible') return;
    if (!today.value) return;
    const dateChanged = todayInTz(tz.value) !== today.value;
    const tooOld = Date.now() - lastLoadedAt.value > REFRESH_INTERVAL_MS;
    if (dateChanged || tooOld) void load();
  }

  onMounted(() => {
    void load();
    document.addEventListener('visibilitychange', refreshIfStale);
  });

  onBeforeUnmount(() => document.removeEventListener('visibilitychange', refreshIfStale));

  return { items, total, today, tz, lang, loading, loadingMore, error, hasMore, load, loadMore };
}
