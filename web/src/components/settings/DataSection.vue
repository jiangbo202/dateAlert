<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../../api/client';
import { purgeArchived } from '../../api/admin';
import { confirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { t } from '../../i18n';

const emit = defineEmits<{ imported: [] }>();
const { showToast } = useToast();

const importing = ref(false);
const mode = ref<'merge' | 'replace'>('merge');
const fileInput = ref<HTMLInputElement | null>(null);

async function onExport(): Promise<void> {
  try {
    const res = await fetch('/api/admin/export');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `date_alert-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(t('data.exported'));
  } catch {
    showToast(t('data.exportFailed'));
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (mode.value === 'replace') {
    const ok = await confirm({
      title: t('data.replaceTitle'),
      message: t('data.replaceBody'),
      confirmText: t('data.replace'),
      cancelText: t('common.cancel'),
      danger: true,
    });
    if (!ok) {
      input.value = '';
      return;
    }
  }

  importing.value = true;
  try {
    const text = await file.text();
    const data = JSON.parse(text) as Record<string, unknown>;
    const result = await api<{ imported: number; skipped: number }>('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify({ mode: mode.value, data }),
    });
    showToast(t('data.imported', { imported: result.imported, skipped: result.skipped }));
    emit('imported');
  } catch {
    showToast(t('data.importFailed'));
  } finally {
    importing.value = false;
    input.value = '';
  }
}

async function onPurgeArchived(): Promise<void> {
  const ok = await confirm({
    title: t('data.purgeTitle'),
    message: t('data.purgeBody'),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true,
  });
  if (!ok) return;
  const deleted = await purgeArchived();
  showToast(t('data.purged', { n: deleted }));
  emit('imported');
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold">{{ t('data.title') }}</h3>

    <div class="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        class="rounded-control border border-line px-3 py-2 text-left text-sm transition hover:border-accent hover:text-accent"
        @click="onExport"
      >
        {{ t('data.export') }}
        <span class="mt-0.5 block text-[11px] text-muted">{{ t('data.exportDesc') }}</span>
      </button>

      <div class="rounded-control border border-line px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm">{{ t('data.import') }}</span>
          <select
            v-model="mode"
            class="rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          >
            <option value="merge">{{ t('data.merge') }}</option>
            <option value="replace">{{ t('data.replace') }}</option>
          </select>
        </div>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFile" />
        <button
          type="button"
          class="mt-2 w-full rounded-control border border-dashed border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
          :disabled="importing"
          @click="fileInput?.click()"
        >
          {{ importing ? t('data.importing') : t('data.chooseFile') }}
        </button>
        <span class="mt-1 block text-[11px] text-muted">{{ t('data.importHint') }}</span>
      </div>
    </div>

    <div class="rounded-control border border-red-200 p-3 dark:border-red-500/30">
      <p class="text-sm font-medium text-red-600">{{ t('data.danger') }}</p>
      <button
        type="button"
        class="mt-2 rounded-control border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
        @click="onPurgeArchived"
      >
        {{ t('data.purge') }}
      </button>
    </div>
  </div>
</template>
