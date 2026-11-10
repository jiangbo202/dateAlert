<script setup lang="ts">
import { locale, setLocale, t, type Locale } from '../i18n';

const options: Array<{ value: Locale; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
];

function toggle(): void {
  const index = options.findIndex((option) => option.value === locale.value);
  setLocale(options[(index + 1) % options.length].value);
}
</script>

<template>
  <button
    type="button"
    :aria-label="t('nav.language')"
    :title="t('nav.language')"
    class="relative grid h-9 w-9 place-items-center rounded-control text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
    @click="toggle"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
    <span class="absolute -bottom-0.5 right-0 text-[9px] font-semibold uppercase">{{ locale === 'en' ? 'EN' : locale === 'zh-TW' ? '繁' : '简' }}</span>
  </button>
</template>
