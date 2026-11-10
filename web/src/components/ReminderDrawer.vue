<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  archiveReminder,
  deleteReminder,
  restoreReminder,
  type ReminderItem,
} from '../api/admin';
import { confirm } from '../composables/useConfirm';
import { useToast } from '../composables/useToast';
import { t } from '../i18n';

const props = defineProps<{ open: boolean; item: ReminderItem | null }>();
const emit = defineEmits<{ close: []; changed: [item: ReminderItem | null]; edit: [item: ReminderItem] }>();

const { showToast } = useToast();
const busy = ref(false);

const daysText = computed(() => {
  const value = props.item?.daysLeft;
  if (value === null || value === undefined) return t('status.undated');
  if (value === 0) return t('day.today');
  if (value < 0) return t('day.overdue', { n: Math.abs(value) });
  return t('day.left', { n: value });
});

const chipLabel = computed(() => {
  const item = props.item;
  if (!item) return '';
  return item.labelKey ? t(`status.${item.labelKey}`) : item.label;
});

const notifyText = computed(() => {
  const item = props.item;
  if (!item) return '';
  if (item.notifyMode === 'off') return t('drawer.notify.off');
  if (item.notifyMode === 'custom') {
    return t('drawer.notify.custom', { list: (item.notifyOffsets ?? []).join(' / ') });
  }
  return t('drawer.notify.global');
});

const statusText = computed(() => {
  const item = props.item;
  if (!item) return '';
  if (!item.isDone) return t('status.active');
  return item.doneBy === 'manual' ? t('status.archivedManual') : t('status.archivedAuto');
});

async function toggleArchive(): Promise<void> {
  const item = props.item;
  if (!item) return;
  busy.value = true;
  try {
    const updated = item.isDone ? await restoreReminder(item.id) : await archiveReminder(item.id);
    showToast(item.isDone ? t('drawer.restored') : t('drawer.archived'));
    emit('changed', updated);
  } catch {
    showToast(t('drawer.failed'));
  } finally {
    busy.value = false;
  }
}

async function remove(): Promise<void> {
  const item = props.item;
  if (!item) return;
  const ok = await confirm({
    title: t('drawer.deleteTitle'),
    message: t('drawer.deleteBody', { title: item.title }),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true,
  });
  if (!ok) return;

  busy.value = true;
  try {
    await deleteReminder(item.id);
    showToast(t('drawer.deleted'));
    emit('changed', null);
    emit('close');
  } catch {
    showToast(t('drawer.deleteFailed'));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" enter-active-class="transition duration-150" leave-to-class="opacity-0" leave-active-class="transition duration-150">
      <div v-if="open" class="fixed inset-0 z-30 bg-slate-900/30" @click="emit('close')" />
    </Transition>

    <Transition
      enter-from-class="translate-x-full"
      enter-active-class="transition duration-200"
      leave-to-class="translate-x-full"
      leave-active-class="transition duration-150"
    >
      <aside
        v-if="open && item"
        role="dialog"
        aria-modal="true"
        :aria-label="t('drawer.label')"
        class="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col overflow-y-auto border-l border-line bg-surface p-5 shadow-card-hover"
      >
        <header class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="break-words text-lg font-semibold">{{ item.title }}</h2>
            <p class="mt-1 text-xs text-muted">{{ item.dueDate || t('status.undated') }} · {{ daysText }}</p>
          </div>
          <button
            type="button"
            :aria-label="t('common.close')"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-control text-muted transition hover:bg-black/5 dark:hover:bg-white/10"
            @click="emit('close')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div
          class="mt-4 rounded-card p-3 text-sm"
          :style="{ background: `color-mix(in srgb, ${item.color} 10%, transparent)`, color: item.color }"
        >
          {{ chipLabel }} · {{ daysText }}
        </div>

        <dl class="mt-5 space-y-3 text-sm">
          <div>
            <dt class="text-xs text-muted">{{ t('drawer.note') }}</dt>
            <dd class="mt-0.5 whitespace-pre-line break-words">{{ item.note || t('common.none') }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('drawer.due') }}</dt>
            <dd class="mt-0.5">{{ item.dueDate || t('status.undated') }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('drawer.public') }}</dt>
            <dd class="mt-0.5">{{ item.isPublic ? t('common.yes') : t('common.no') }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('drawer.notify') }}</dt>
            <dd class="mt-0.5">{{ notifyText }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('drawer.status') }}</dt>
            <dd class="mt-0.5">{{ statusText }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('drawer.created') }}</dt>
            <dd class="mt-0.5 text-xs text-muted">{{ new Date(item.createdAt).toLocaleString() }}</dd>
          </div>
        </dl>

        <div class="mt-auto grid gap-2 pt-6">
          <button
            type="button"
            class="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            :disabled="busy"
            @click="emit('edit', item)"
          >
            {{ t('common.edit') }}
          </button>
          <button
            type="button"
            class="rounded-control border border-line px-3 py-2 text-sm transition hover:border-accent hover:text-accent disabled:opacity-50"
            :disabled="busy"
            @click="toggleArchive"
          >
            {{ item.isDone ? t('list.restore') : t('list.archive') }}
          </button>
          <button
            type="button"
            class="rounded-control border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
            :disabled="busy"
            @click="remove"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
