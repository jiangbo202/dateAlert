<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ApiError } from '../api/client';
import { createReminder, updateReminder, type ReminderItem, type ReminderPayload } from '../api/admin';
import { t } from '../i18n';

const props = defineProps<{ open: boolean; item: ReminderItem | null }>();
const emit = defineEmits<{ close: []; saved: [item: ReminderItem] }>();

const title = ref('');
const note = ref('');
const dueDate = ref('');
const isPublic = ref(true);
const notifyMode = ref<ReminderPayload['notifyMode']>('global');
const noDate = ref(false);
const offsets = ref<number[]>([]);
const offsetInput = ref('');

const submitting = ref(false);
const errorText = ref('');
const fieldErrors = ref<Record<string, string>>({});

const todayValue = computed(() => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
});

const isPastDate = computed(() => Boolean(dueDate.value) && dueDate.value < todayValue.value);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const item = props.item;
    title.value = item?.title ?? '';
    note.value = item?.note ?? '';
    dueDate.value = item?.dueDate ?? '';
    noDate.value = item ? !item.dueDate : false;
    isPublic.value = item?.isPublic ?? true;
    notifyMode.value = item?.notifyMode ?? 'global';
    offsets.value = item?.notifyOffsets ? [...item.notifyOffsets] : [];
    offsetInput.value = '';
    errorText.value = '';
    fieldErrors.value = {};
  },
);

function addOffset(): void {
  const parsed = Number(offsetInput.value.trim());
  offsetInput.value = '';
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
    errorText.value = t('form.err.offsetsRange');
    return;
  }
  if (offsets.value.includes(parsed)) return;
  if (offsets.value.length >= 10) {
    errorText.value = t('form.err.offsetsMax');
    return;
  }
  offsets.value = [...offsets.value, parsed].sort((a, b) => a - b);
  errorText.value = '';
}

function removeOffset(value: number): void {
  offsets.value = offsets.value.filter((entry) => entry !== value);
}

function validate(): boolean {
  const errors: Record<string, string> = {};
  if (!title.value.trim() || title.value.trim().length > 50) errors.title = t('form.err.title');
  if (note.value.length > 200) errors.note = t('form.err.note');
  if (!noDate.value && !dueDate.value) errors.dueDate = t('form.err.due');
  if (notifyMode.value === 'custom' && offsets.value.length === 0) errors.offsets = t('form.err.offsets');
  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function submit(): Promise<void> {
  errorText.value = '';
  if (!validate()) return;

  const payload: ReminderPayload = {
    title: title.value.trim(),
    note: note.value.trim(),
    dueDate: noDate.value ? '' : dueDate.value,
    isPublic: isPublic.value,
    notifyMode: notifyMode.value,
    notifyOffsets: notifyMode.value === 'custom' ? offsets.value : null,
  };

  submitting.value = true;
  try {
    const saved = props.item
      ? await updateReminder(props.item.id, payload)
      : await createReminder(payload);
    emit('saved', saved);
    emit('close');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
      const issues = error.body?.issues ?? [];
      const map: Record<string, string> = {};
      for (const issue of issues) if (issue.field) map[issue.field] = issue.message;
      fieldErrors.value = map;
      errorText.value = issues[0]?.message ?? t('form.saveFailed');
    } else {
      errorText.value = t('form.saveFailed');
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      enter-active-class="transition duration-150"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/40 px-4 py-8"
        @click.self="emit('close')"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-label="item ? t('form.edit') : t('form.create')"
          class="w-full max-w-lg rounded-card border border-line bg-surface p-5 shadow-card-hover"
        >
          <header class="flex items-start justify-between">
            <h2 class="text-base font-semibold">{{ item ? t('form.edit') : t('form.create') }}</h2>
            <button
              type="button"
              :aria-label="t('common.close')"
              class="grid h-8 w-8 place-items-center rounded-control text-muted transition hover:bg-black/5 dark:hover:bg-white/10"
              @click="emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <form class="mt-4 space-y-4" @submit.prevent="submit">
            <div>
              <label for="rf-title" class="mb-1 block text-xs font-medium text-muted">{{ t('form.title') }}</label>
              <input
                id="rf-title"
                v-model="title"
                maxlength="50"
                :placeholder="t('form.titlePlaceholder')"
                class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
              <p v-if="fieldErrors.title" class="mt-1 text-[11px] text-red-600">{{ fieldErrors.title }}</p>
            </div>

            <div>
              <label for="rf-note" class="mb-1 block text-xs font-medium text-muted">{{ t('form.note') }}</label>
              <input
                id="rf-note"
                v-model="note"
                maxlength="200"
                :placeholder="t('form.notePlaceholder')"
                class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
              <p v-if="fieldErrors.note" class="mt-1 text-[11px] text-red-600">{{ fieldErrors.note }}</p>
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between gap-2">
                <label for="rf-date" class="block text-xs font-medium text-muted">{{ t('form.due') }}</label>
                <div class="flex items-center gap-1.5 text-xs text-muted">
                  <input id="rf-nodate" v-model="noDate" type="checkbox" class="h-3.5 w-3.5" />
                  <label for="rf-nodate" class="cursor-pointer">{{ t('form.noDate') }}</label>
                </div>
              </div>
              <input
                id="rf-date"
                v-model="dueDate"
                type="date"
                :disabled="noDate"
                class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent disabled:opacity-50"
              />
              <p v-if="fieldErrors.dueDate" class="mt-1 text-[11px] text-red-600">{{ fieldErrors.dueDate }}</p>
              <p v-else-if="noDate" class="mt-1 text-[11px] text-muted">{{ t('form.noDateHint') }}</p>
              <p v-else-if="isPastDate" class="mt-1 text-[11px] text-amber-600">
                {{ t('form.pastHint') }}
              </p>
            </div>

            <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
              <span class="text-sm">{{ t('form.public') }}</span>
              <input v-model="isPublic" type="checkbox" class="h-4 w-4" />
            </label>

            <div>
              <span class="mb-1 block text-xs font-medium text-muted">{{ t('form.notify') }}</span>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="option in [
                    { value: 'global', label: t('form.notify.global') },
                    { value: 'off', label: t('form.notify.off') },
                    { value: 'custom', label: t('form.notify.custom') },
                  ]"
                  :key="option.value"
                  :class="[
                    'cursor-pointer rounded-control border px-3 py-1.5 text-xs transition',
                    notifyMode === option.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:border-accent/50',
                  ]"
                >
                  <input v-model="notifyMode" type="radio" :value="option.value" class="sr-only" />
                  {{ option.label }}
                </label>
              </div>

              <div v-if="notifyMode === 'custom'" class="mt-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    v-for="value in offsets"
                    :key="value"
                    class="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                  >
                    {{ value }}
                    <button type="button" :aria-label="t('common.remove')" class="text-accent/70 hover:text-accent" @click="removeOffset(value)">
                      ×
                    </button>
                  </span>
                  <input
                    v-model="offsetInput"
                    inputmode="numeric"
                    :placeholder="t('form.offsetsPlaceholder')"
                    class="w-20 rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                    @keydown.enter.prevent="addOffset"
                  />
                  <button
                    type="button"
                    class="rounded-control border border-line px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
                    @click="addOffset"
                  >
                    {{ t('common.add') }}
                  </button>
                </div>
                <p class="mt-1 text-[11px] text-muted">{{ t('form.offsetsHint') }}</p>
                <p v-if="fieldErrors.offsets" class="mt-1 text-[11px] text-red-600">{{ fieldErrors.offsets }}</p>
              </div>
            </div>

            <p v-if="errorText" role="alert" class="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {{ errorText }}
            </p>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="rounded-control px-3 py-2 text-sm text-muted transition hover:bg-black/5 dark:hover:bg-white/10"
                @click="emit('close')"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="submitting"
                class="rounded-control bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {{ submitting ? t('common.saving') : t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
