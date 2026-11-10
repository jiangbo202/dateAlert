<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsView } from '../../composables/useSettings';
import { formatInZone, useSettingsPanels } from '../../composables/useSettingsPanels';
import { t } from '../../i18n';

const props = defineProps<{ draft: SettingsView }>();
const { timeZones, localNow } = useSettingsPanels();

const currentTime = computed(() => formatInZone(localNow.value, props.draft.tz));

const grouped = computed(() => {
  const list = timeZones.value.includes(props.draft.tz)
    ? timeZones.value
    : [props.draft.tz, ...timeZones.value];
  return list;
});
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold">{{ t('settings.tz') }}</h3>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs text-muted">{{ t('settings.tz') }}</span>
        <select
          v-model="draft.tz"
          class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option v-for="zone in grouped" :key="zone" :value="zone">{{ zone }}</option>
        </select>
        <span class="mt-1 block text-[11px] text-muted">{{ t('settings.tzCurrent', { time: currentTime }) }}</span>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs text-muted">{{ t('settings.defaultLang') }}</span>
        <select
          v-model="draft.lang"
          class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="auto">{{ t('settings.lang.auto') }}</option>
          <option value="zh-CN">{{ t('settings.lang.zhCN') }}</option>
          <option value="zh-TW">{{ t('settings.lang.zhTW') }}</option>
          <option value="en">{{ t('settings.lang.en') }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs text-muted">{{ t('settings.notifyLang') }}</span>
        <select
          v-model="draft.notifyLang"
          class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="zh-CN">{{ t('settings.lang.zhCN') }}</option>
          <option value="zh-TW">{{ t('settings.lang.zhTW') }}</option>
          <option value="en">{{ t('settings.lang.en') }}</option>
        </select>
        <span class="mt-1 block text-[11px] text-muted">{{ t('settings.notifyLangHint') }}</span>
      </label>
    </div>
  </div>
</template>
