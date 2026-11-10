<script setup lang="ts">
import { ref } from 'vue';
import type { SettingsView } from '../../composables/useSettings';
import { testBarkPush } from '../../composables/useSettingsPanels';
import { t } from '../../i18n';

const props = defineProps<{
  draft: SettingsView;
  newKey: string;
  clearKey: boolean;
  saving: boolean;
}>();
const emit = defineEmits<{ 'update:newKey': [value: string]; 'update:clearKey': [value: boolean] }>();

const offsetInput = ref('');
const testState = ref<{ running: boolean; ok?: boolean; message?: string }>({ running: false });

function addOffset(): void {
  const parsed = Number(offsetInput.value.trim());
  offsetInput.value = '';
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) return;
  if (props.draft.notify.offsets.includes(parsed)) return;
  props.draft.notify.offsets = [...props.draft.notify.offsets, parsed].sort((a, b) => a - b);
}

function removeOffset(value: number): void {
  props.draft.notify.offsets = props.draft.notify.offsets.filter((item) => item !== value);
}

async function runTest(): Promise<void> {
  testState.value = { running: true };
  const result = await testBarkPush();
  testState.value = {
    running: false,
    ok: result.ok,
    message: result.ok
      ? t('notify.testOk', { status: result.httpStatus ?? '' })
      : t('notify.testFail', { error: result.error ?? '' }),
  };
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold">{{ t('notify.title') }}</h3>

    <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
      <span class="text-sm">{{ t('notify.enable') }}</span>
      <input v-model="draft.notify.enabled" type="checkbox" class="h-4 w-4" />
    </label>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs text-muted">{{ t('notify.time') }}</span>
        <input
          v-model="draft.notify.time"
          type="time"
          class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <span class="mt-1 block text-[11px] text-muted">{{ t('notify.timeHint', { tz: draft.tz }) }}</span>
      </label>

      <div>
        <span class="mb-1 block text-xs text-muted">{{ t('notify.offsets') }}</span>
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-for="value in draft.notify.offsets"
            :key="value"
            class="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
          >
            {{ value }}
            <button type="button" aria-label="移除" class="text-accent/70 hover:text-accent" @click="removeOffset(value)">×</button>
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
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <span class="text-sm">{{ t('notify.digest') }}</span>
        <input v-model="draft.notify.digest.enabled" type="checkbox" class="h-4 w-4" />
      </label>
      <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <span class="text-sm">{{ t('notify.digestWindow') }}</span>
        <input
          v-model.number="draft.notify.digest.windowDays"
          type="number"
          min="1"
          max="30"
          class="w-20 rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        />
      </label>
    </div>

    <div class="rounded-control border border-line p-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">{{ t('notify.bark') }}</h4>
        <label class="flex items-center gap-2 text-xs text-muted">
          <input v-model="draft.notify.bark.enabled" type="checkbox" class="h-4 w-4" />
          {{ t('notify.barkEnable') }}
        </label>
      </div>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs text-muted">{{ t('notify.baseUrl') }}</span>
          <input
            v-model="draft.notify.bark.baseUrl"
            placeholder="https://api.day.app"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs text-muted">{{ t('notify.deviceKey') }}</span>
          <div class="flex gap-2">
            <input
              :value="newKey"
              type="password"
              :placeholder="draft.notify.bark.hasKey ? t('notify.keySet') : t('notify.keyPlaceholder')"
              class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              @input="emit('update:newKey', ($event.target as HTMLInputElement).value)"
            />
            <button
              v-if="draft.notify.bark.hasKey"
              type="button"
              class="shrink-0 rounded-control border border-line px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
              @click="emit('update:clearKey', !clearKey)"
            >
              {{ clearKey ? t('notify.clearKeyCancel') : t('notify.clearKey') }}
            </button>
          </div>
          <span v-if="clearKey" class="mt-1 block text-[11px] text-red-600">{{ t('notify.clearKeyHint') }}</span>
        </label>

        <label class="block">
          <span class="mb-1 block text-xs text-muted">{{ t('notify.group') }}</span>
          <input
            v-model="draft.notify.bark.group"
            maxlength="30"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs text-muted">{{ t('notify.sound') }}</span>
          <input
            v-model="draft.notify.bark.sound"
            maxlength="30"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs text-muted">{{ t('notify.level') }}</span>
          <select
            v-model="draft.notify.bark.level"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="active">active</option>
            <option value="timeSensitive">timeSensitive</option>
            <option value="passive">passive</option>
            <option value="critical">critical</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-xs text-muted">{{ t('notify.icon') }}</span>
          <input
            v-model="draft.notify.bark.icon"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-control border border-line px-3 py-2 text-xs transition hover:border-accent hover:text-accent disabled:opacity-50"
          :disabled="testState.running || saving"
          @click="runTest"
        >
          {{ testState.running ? t('notify.testing') : t('notify.test') }}
        </button>
        <span
          v-if="testState.message"
          :class="['text-xs', testState.ok ? 'text-emerald-600' : 'text-red-600']"
        >
          {{ testState.message }}
        </span>
        <span class="text-[11px] text-muted">{{ t('notify.mergeHint') }}</span>
      </div>
    </div>
  </div>
</template>
