<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { clearLogs, fetchLogs, type LogItem } from '../../composables/useSettingsPanels';
import { confirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { t } from '../../i18n';

const { showToast } = useToast();
const items = ref<LogItem[]>([]);
const total = ref(0);
const page = ref(1);
const size = 20;
const status = ref<'all' | 'ok' | 'failed'>('all');
const stats = ref<Record<string, number>>({ ok: 0, failed: 0 });
const loading = ref(false);
const error = ref<string | null>(null);
const expanded = ref<number | null>(null);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchLogs({ status: status.value, page: page.value, size });
    items.value = data.items;
    total.value = data.total;
    stats.value = data.stats7d ?? { ok: 0, failed: 0 };
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

function setStatus(next: 'all' | 'ok' | 'failed'): void {
  status.value = next;
  page.value = 1;
  void load();
}

function setPage(next: number): void {
  page.value = next;
  void load();
}

async function onClear(): Promise<void> {
  const ok = await confirm({ title: t('logs.clearTitle'), message: t('logs.clearBody'), confirmText: t('common.delete'), cancelText: t('common.cancel'), danger: true });
  if (!ok) return;
  const deleted = await clearLogs();
  showToast(t('logs.cleared', { n: deleted }));
  page.value = 1;
  await load();
}

function pretty(detail: unknown): string {
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">{{ t('logs.title') }}</h3>
      <button
        type="button"
        class="rounded-control border border-line px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
        @click="onClear"
      >
        {{ t('logs.clear') }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-xs">
      <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600">{{ t('logs.ok7', { n: stats.ok ?? 0 }) }}</span>
      <span class="rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">{{ t('logs.failed', { n: stats.failed ?? 0 }) }}</span>
      <div class="ml-auto flex gap-1">
        <button
          v-for="option in [
            { value: 'all', label: t('logs.all') },
            { value: 'failed', label: t('logs.onlyFailed') },
            { value: 'ok', label: t('logs.onlyOk') },
          ]"
          :key="option.value"
          type="button"
          :class="[
            'rounded-control px-2.5 py-1 transition',
            status === option.value ? 'bg-accent text-white' : 'border border-line text-muted hover:border-accent hover:text-accent',
          ]"
          @click="setStatus(option.value as 'all' | 'ok' | 'failed')"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <p v-if="error" class="rounded-card bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
      {{ t('common.loadFailed') }}：{{ error }}
    </p>

    <div v-if="loading" class="space-y-2">
      <div v-for="n in 4" :key="n" class="h-12 animate-pulse rounded-card bg-black/5 dark:bg-white/5" />
    </div>

    <p v-else-if="items.length === 0" class="rounded-card border border-dashed border-line p-8 text-center text-xs text-muted">
      {{ t('logs.empty') }}
    </p>

    <div v-else class="overflow-hidden rounded-card border border-line">
      <table class="w-full text-sm">
        <thead class="bg-black/[0.02] text-left text-xs text-muted dark:bg-white/[0.03]">
          <tr>
            <th class="px-3 py-2 font-medium">{{ t('logs.col.time') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('logs.col.trigger') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('logs.col.status') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('logs.col.items') }}</th>
            <th class="hidden px-3 py-2 font-medium sm:table-cell">{{ t('logs.col.title') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('logs.col.elapsed') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('logs.col.error') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="log in items" :key="log.id">
            <tr
              :class="[
                'cursor-pointer border-t border-line transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
                log.status === 'failed' ? 'bg-red-50/60 dark:bg-red-500/5' : '',
              ]"
              @click="expanded = expanded === log.id ? null : log.id"
            >
              <td class="whitespace-nowrap px-3 py-2 text-xs text-muted">{{ log.created_at.replace('T', ' ').slice(0, 19) }}</td>
              <td class="px-3 py-2 text-xs">{{ log.trigger }}</td>
              <td class="px-3 py-2 text-xs">
                <span :class="log.status === 'ok' ? 'text-emerald-600' : 'text-red-600'">
                  {{ log.status }}{{ log.attempts > 1 ? ` ×${log.attempts}` : '' }}
                </span>
              </td>
              <td class="px-3 py-2 text-xs">{{ log.item_count }}</td>
              <td class="hidden max-w-[220px] truncate px-3 py-2 text-xs sm:table-cell">{{ log.title ?? t('common.none') }}</td>
              <td class="whitespace-nowrap px-3 py-2 text-xs text-muted">{{ log.elapsed_ms ?? t('common.none') }}ms</td>
              <td class="max-w-[200px] truncate px-3 py-2 text-xs text-red-600">{{ log.error ?? '' }}</td>
            </tr>
            <tr v-if="expanded === log.id" :key="`${log.id}-detail`" class="border-t border-line bg-black/[0.02] dark:bg-white/[0.03]">
              <td colspan="7" class="px-3 py-3">
                <p class="mb-2 text-[11px] font-medium text-muted">{{ t('logs.detail') }}</p>
                <pre class="max-h-64 overflow-auto rounded-control bg-black/5 p-3 text-[11px] leading-relaxed dark:bg-black/30">{{ pretty(log.detail) }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="total > 0" class="flex items-center justify-between text-xs text-muted">
      <span>{{ t('list.pageInfo', { total, page, pages: totalPages }) }}</span>
      <div class="flex gap-1">
        <button
          type="button"
          class="rounded-control border border-line px-2.5 py-1 transition disabled:opacity-40"
          :disabled="page <= 1"
          @click="setPage(page - 1)"
        >
          {{ t('list.prev') }}
        </button>
        <button
          type="button"
          class="rounded-control border border-line px-2.5 py-1 transition disabled:opacity-40"
          :disabled="page >= totalPages"
          @click="setPage(page + 1)"
        >
          {{ t('list.next') }}
        </button>
      </div>
    </div>
  </div>
</template>
