<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../i18n';

const props = defineProps<{
  title: string;
  note: string;
  daysLeft: number | null;
  dueDate: string;
  color: string;
  label: string;
  labelKey: 'overdue' | 'fallback' | 'undated' | null;
}>();

const daysNumber = computed(() => {
  if (props.daysLeft === null) return null;
  if (props.daysLeft === 0) return null;
  if (props.daysLeft < 0) return Math.abs(props.daysLeft);
  return props.daysLeft;
});

const daysText = computed(() => {
  if (props.daysLeft === null) return t('status.undated');
  if (props.daysLeft === 0) return t('day.today');
  if (props.daysLeft < 0) return t('day.overdue', { n: Math.abs(props.daysLeft) });
  return null;
});

const showUnit = computed(() => typeof props.daysLeft === 'number' && props.daysLeft > 0);

const chipLabel = computed(() => (props.labelKey ? t(`status.${props.labelKey}`) : props.label));
const urgent = computed(() => props.daysLeft <= 1);
</script>

<template>
  <article
    class="reminder-card flex min-h-[132px] min-w-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    :style="{ '--c': color }"
    :data-urgent="urgent"
  >
    <header class="flex items-start justify-between gap-2">
      <h2 class="line-clamp-2 min-w-0 break-words text-[18px] font-semibold leading-snug" :title="title">
        {{ title }}
      </h2>
      <span
        v-if="labelKey !== 'undated'"
        class="reminder-card__chip shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
      >
        {{ chipLabel }}
      </span>
    </header>

    <p class="mt-3 flex items-baseline gap-1">
      <template v-if="daysNumber !== null">
        <span class="text-[40px] font-bold leading-none">{{ daysNumber }}</span>
        <span v-if="showUnit" class="text-sm font-medium">{{ t('common.days') }}</span>
      </template>
      <span v-else :class="daysLeft === null ? 'text-[20px] font-semibold leading-none opacity-80' : 'text-[26px] font-bold leading-none'">
        {{ daysText }}
      </span>
    </p>

    <footer class="mt-3 space-y-1">
      <p v-if="note" class="reminder-card__note text-xs opacity-80" :title="note">{{ note }}</p>
      <p v-if="daysLeft !== null" class="text-[11px] opacity-60">{{ dueDate }}</p>
    </footer>
  </article>
</template>
