<script setup lang="ts">
import { onMounted } from 'vue';
import { useSettings } from '../../composables/useSettings';
import { useToast } from '../../composables/useToast';
import ColorSection from './ColorSection.vue';
import TimeLocaleSection from './TimeLocaleSection.vue';
import NotifySection from './NotifySection.vue';
import LogsSection from './LogsSection.vue';
import DataSection from './DataSection.vue';
import { t } from '../../i18n';

const emit = defineEmits<{ changed: [] }>();
const { showToast } = useToast();
const {
  draft,
  loading,
  saving,
  loadError,
  saveError,
  issues,
  newKey,
  clearKey,
  dirty,
  loadSettings,
  saveSettings,
  resetDraft,
} = useSettings();

const issueText = (code: string): string => {
  const map: Record<string, string> = {
    RULE_OVERLAP: t('colors.overlap'),
    RULE_RANGE_INVALID: t('colors.overlap'),
    RULE_COLOR_INVALID: t('colors.overlap'),
    RULE_LABEL_INVALID: t('colors.label'),
    TZ_INVALID: t('settings.tz'),
    TIME_INVALID: t('notify.time'),
    BARK_URL_INVALID: t('notify.baseUrl'),
    BARK_ICON_INVALID: t('notify.icon'),
    DIGEST_WINDOW_INVALID: t('notify.digestWindow'),
    VALIDATION_FAILED: t('data.settingsSaved'),
    NETWORK_ERROR: t('data.exportFailed'),
  };
  return map[code] ?? code;
};

async function save(): Promise<void> {
  const ok = await saveSettings();
  if (ok) {
    showToast(t('data.settingsSaved'));
    emit('changed');
  } else {
    showToast(issueText(saveError.value ?? ''));
  }
}

onMounted(() => void loadSettings());
</script>

<template>
  <div class="space-y-6">
    <p v-if="loadError" class="rounded-card bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
      {{ t('common.loadFailed') }}：{{ loadError }}
      <button type="button" class="ml-2 underline" @click="loadSettings()">{{ t('common.retry') }}</button>
    </p>

    <div v-else-if="loading || !draft" class="space-y-3">
      <div v-for="n in 4" :key="n" class="h-24 animate-pulse rounded-card bg-black/5 dark:bg-white/5" />
    </div>

    <template v-else>
      <section class="rounded-card border border-line p-4">
        <h3 class="text-sm font-semibold">{{ t('settings.account') }}</h3>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted">{{ t('settings.accountDesc') }}</p>
          <RouterLink
            to="/change-password"
            class="rounded-control border border-line px-3 py-1.5 text-xs transition hover:border-accent hover:text-accent"
          >
            {{ t('nav.changePassword') }}
          </RouterLink>
        </div>
      </section>

      <section class="rounded-card border border-line p-4">
        <TimeLocaleSection :draft="draft" />
      </section>

      <section class="rounded-card border border-line p-4">
        <ColorSection :draft="draft" />
      </section>

      <section class="rounded-card border border-line p-4">
        <NotifySection
          :draft="draft"
          :new-key="newKey"
          :clear-key="clearKey"
          :saving="saving"
          @update:new-key="newKey = $event"
          @update:clear-key="clearKey = $event"
        />
      </section>

      <section class="rounded-card border border-line p-4">
        <LogsSection />
      </section>

      <section class="rounded-card border border-line p-4">
        <DataSection @imported="emit('changed')" />
      </section>

      <p v-if="issues.length" class="rounded-card bg-red-50 p-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
        <span v-for="(issue, index) in issues" :key="index" class="block">
          {{ issue.field }}：{{ issueText(issue.code) }}
        </span>
      </p>

      <div
        v-if="dirty"
        class="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-card-hover backdrop-blur"
      >
        <span class="text-xs text-muted">{{ t('data.unsaved') }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-control px-3 py-1.5 text-xs text-muted transition hover:bg-black/5 dark:hover:bg-white/10"
            @click="resetDraft"
          >
            {{ t('data.discard') }}
          </button>
          <button
            type="button"
            class="rounded-control bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
