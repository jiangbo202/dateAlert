<script setup lang="ts">
import { onMounted } from 'vue';
import AppToast from './components/AppToast.vue';
import AppConfirm from './components/AppConfirm.vue';
import { initTheme } from './composables/useTheme';
import { initLocale } from './i18n';
import { useVersionCheck } from './composables/useVersionCheck';

useVersionCheck();

onMounted(() => {
  initTheme();
  initLocale();
});
</script>

<template>
  <RouterView />
  <AppToast />
  <AppConfirm />
</template>
