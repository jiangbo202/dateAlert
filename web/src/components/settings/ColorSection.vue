<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsView } from '../../composables/useSettings';
import { findOverlap, isInvalidRule, pickColor } from '../../lib/color';
import { t } from '../../i18n';

const props = defineProps<{ draft: SettingsView }>();

const previewDays = [-1, 0, 1, 2, 7, 15, 30];

const overlap = computed(() => findOverlap(props.draft.colors.rules));
const invalidIds = computed(
  () => new Set(props.draft.colors.rules.filter((rule) => isInvalidRule(rule)).map((rule) => rule.id)),
);

const preview = computed(() =>
  previewDays.map((days) => ({
    days,
    ...pickColor(days, props.draft.colors),
  })),
);

function addRule(): void {
  const rules = props.draft.colors.rules;
  const max = rules.reduce((acc, rule) => Math.max(acc, rule.max), 0);
  rules.push({
    id: `r${Date.now().toString(36)}`,
    min: max + 1,
    max: max + 7,
    color: '#8B5CF6',
    label: t('colors.newRule'),
  });
}

function removeRule(id: string): void {
  props.draft.colors.rules = props.draft.colors.rules.filter((rule) => rule.id !== id);
}

function restoreDefaults(): void {
  props.draft.colors = {
    overdue: '#94A3B8',
    default: '#3B82F6',
    rules: [
      { id: 'r1', min: 0, max: 1, color: '#F59E0B', label: t('colors.rule1') },
      { id: 'r2', min: 2, max: 7, color: '#10B981', label: t('colors.rule2') },
    ],
  };
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">{{ t('colors.title') }}</h3>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-control border border-line px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
          @click="addRule"
        >
          {{ t('colors.add') }}
        </button>
        <button
          type="button"
          class="rounded-control border border-line px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
          @click="restoreDefaults"
        >
          {{ t('colors.restore') }}
        </button>
      </div>
    </div>

    <p v-if="overlap" class="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
      {{ t('colors.overlap') }}
    </p>

    <div class="space-y-2">
      <div
        v-for="rule in draft.colors.rules"
        :key="rule.id"
        :class="[
          'flex flex-wrap items-center gap-2 rounded-control border px-3 py-2',
          overlap?.includes(rule.id) || invalidIds.has(rule.id)
            ? 'border-red-300 dark:border-red-500/40'
            : 'border-line',
        ]"
      >
        <input
          v-model.number="rule.min"
          type="number"
          min="0"
          class="w-16 rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <span class="text-xs text-muted">{{ t('colors.range') }}</span>
        <input
          v-model.number="rule.max"
          type="number"
          min="0"
          class="w-16 rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <span class="text-xs text-muted">{{ t('common.days') }}</span>
        <input
          v-model="rule.color"
          type="color"
          class="h-7 w-9 cursor-pointer rounded border border-line bg-transparent"
        />
        <input
          v-model="rule.label"
          maxlength="20"
          :placeholder="t('colors.label')"
          class="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <span
          class="rounded-full px-2 py-0.5 text-[11px]"
          :style="{ background: `color-mix(in srgb, ${rule.color} 16%, transparent)`, color: rule.color }"
        >
          {{ rule.label || t('colors.label') }}
        </span>
        <button
          type="button"
          class="rounded-control px-2 py-1 text-xs text-red-500 transition hover:text-red-600"
          @click="removeRule(rule.id)"
        >
          {{ t('common.delete') }}
        </button>
      </div>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <span class="text-sm">{{ t('colors.expired') }}</span>
        <input v-model="draft.colors.overdue" type="color" class="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" />
      </label>
      <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <span class="text-sm">{{ t('colors.outOfRange') }}</span>
        <input v-model="draft.colors.default" type="color" class="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" />
      </label>
    </div>

    <div>
      <p class="mb-2 text-xs text-muted">{{ t('colors.preview') }}</p>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="item in preview"
          :key="item.days"
          class="reminder-card min-w-[92px] rounded-[var(--radius-card)] px-3 py-2 shadow-card"
          :style="{ '--c': item.color }"
        >
          <p class="text-[11px] opacity-70">{{ item.labelKey ? t(`status.${item.labelKey}`) : item.label }}</p>
          <p class="text-lg font-semibold leading-tight">
            {{ item.days < 0 ? `-${Math.abs(item.days)}` : item.days }}
            <span class="text-[11px] font-normal">{{ t('common.days') }}</span>
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <label class="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <span class="text-sm">{{ t('colors.dark') }}</span>
        <select
          v-model="draft.display.darkMode"
          class="rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        >
          <option value="auto">{{ t('colors.dark.auto') }}</option>
          <option value="light">{{ t('colors.dark.light') }}</option>
          <option value="dark">{{ t('colors.dark.dark') }}</option>
        </select>
      </label>
    </div>
  </div>
</template>
