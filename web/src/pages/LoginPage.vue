<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LanguageMenu from '../components/LanguageMenu.vue';
import { useSession } from '../composables/useSession';
import { useTheme } from '../composables/useTheme';
import { t } from '../i18n';

const router = useRouter();
const route = useRoute();
const { login } = useSession();
const { toggleTheme } = useTheme();

const password = ref('');
const showPassword = ref(false);
const remember = ref(false);
const submitting = ref(false);
const errorText = ref('');
const cooldown = ref(0);
let cooldownTimer: number | undefined;

const canSubmit = computed(() => password.value.length > 0 && !submitting.value && cooldown.value === 0);

function startCooldown(seconds: number): void {
  cooldown.value = Math.max(1, seconds);
  window.clearInterval(cooldownTimer);
  cooldownTimer = window.setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) window.clearInterval(cooldownTimer);
  }, 1000);
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  errorText.value = '';

  const error = await login(password.value, remember.value);
  submitting.value = false;

  if (error) {
    if (error.code === 'TOO_MANY_ATTEMPTS') {
      startCooldown(error.retryAfter || 900);
      errorText.value = t('login.locked', { n: cooldown.value });
      return;
    }
    errorText.value = error.code === 'PASSWORD_WRONG' ? t('login.wrong') : t('login.failed');
    password.value = '';
    return;
  }

  const rawNext = typeof route.query.next === 'string' ? route.query.next : '';
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && rawNext !== '/' && rawNext !== '/login'
      ? rawNext
      : '/admin';
  await router.replace(safeNext);
}

onBeforeUnmount(() => window.clearInterval(cooldownTimer));
</script>

<template>
  <div class="grid min-h-screen place-items-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex items-center justify-between">
        <RouterLink to="/" class="text-lg font-semibold tracking-tight">{{ t('brand') }}</RouterLink>
        <div class="flex items-center gap-1">
          <LanguageMenu />
          <button
            type="button"
            :aria-label="t('nav.theme')"
            class="grid h-9 w-9 place-items-center rounded-control text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
            @click="toggleTheme"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          </button>
        </div>
      </div>

      <h1 class="text-xl font-semibold">{{ t('login.title') }}</h1>
      <p class="mt-1 text-xs text-muted">{{ t('login.desc') }}</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label for="password" class="mb-1 block text-xs font-medium text-muted">{{ t('login.password') }}</label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              autofocus
              :disabled="cooldown > 0"
              class="w-full rounded-control border border-line bg-surface px-3 py-2 pr-10 text-sm outline-none transition focus:border-accent disabled:opacity-60"
              :placeholder="t('login.passwordPlaceholder')"
            />
            <button
              type="button"
              :aria-label="showPassword ? t('login.hide') : t('login.show')"
              class="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.6 2.2-1.7 3.4M6.2 6.8C4.2 8.3 3 10.2 3 12c0 2.5 4 7 9 7 1.2 0 2.4-.3 3.4-.7" />
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          </div>
        </div>

        <label class="flex items-center gap-2 text-xs text-muted">
          <input v-model="remember" type="checkbox" class="h-4 w-4 rounded border-line" />
          {{ t('login.remember') }}
        </label>

        <p v-if="errorText" role="alert" class="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {{ errorText }}
        </p>

        <button
          type="submit"
          :disabled="!canSubmit"
          class="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {{ submitting ? t('login.submitting') : cooldown > 0 ? t('login.wait', { n: cooldown }) : t('login.submit') }}
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-muted">
        <RouterLink to="/" class="hover:text-accent">← {{ t('login.backHome') }}</RouterLink>
      </p>
    </div>
  </div>
</template>
