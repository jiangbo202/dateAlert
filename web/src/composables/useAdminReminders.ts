import { onBeforeUnmount, ref } from 'vue';
import { listReminders, type ReminderItem, type ReminderScope } from '../api/admin';

export function useAdminReminders() {
  const items = ref<ReminderItem[]>([]);
  const total = ref(0);
  const page = ref(1);
  const size = ref(20);
  const scope = ref<ReminderScope>('active');
  const keyword = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);

  let searchTimer: number | undefined;

  async function reload(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await listReminders({
        scope: scope.value,
        q: keyword.value.trim() || undefined,
        page: page.value,
        size: size.value,
      });
      items.value = data.items;
      total.value = data.total;
      if (data.items.length === 0 && page.value > 1) {
        page.value = 1;
        await reload();
      }
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  function setScope(next: ReminderScope): void {
    scope.value = next;
    page.value = 1;
    void reload();
  }

  function setKeyword(next: string): void {
    keyword.value = next;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      page.value = 1;
      void reload();
    }, 300);
  }

  function setPage(next: number): void {
    page.value = next;
    void reload();
  }

  onBeforeUnmount(() => window.clearTimeout(searchTimer));

  return { items, total, page, size, scope, keyword, loading, error, reload, setScope, setKeyword, setPage };
}
