<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import LanguageMenu from '../components/LanguageMenu.vue';
import { useSession } from '../composables/useSession';
import { useTheme } from '../composables/useTheme';
import { t } from '../i18n';

const router = useRouter();
const { setup, setupRequiresToken } = useSession();
const { toggleTheme } = useTheme();

const password = ref('');
const confirm = ref('');
const token = ref('');
const submitting = ref(false);
const errorText = ref('');

const canSubmit = computed(() => password.value.length > 0 && confirm.value.length > 0 && !submitting.value);

async function submit(): Promise<void> {
  errorText.value = '';

  if (password.value.length < 12 || password.value.length > 64) {
    errorText.value = t('pwd.err.length');
    return;
  }
  if (!/[A-Za-z]/.test(password.value) || !/[0-9]/.test(password.value)) {
    errorText.value = t('pwd.err.chars');
    return;
  }
  if (password.value !== confirm.value) {
    errorText.value = t('pwd.err.mismatch');
    return;
  }

  submitting.value = true;
  const error = await setup(password.value, token.value);
  submitting.value = false;

  if (error) {
    if (error.code === 'ALREADY_INITIALIZED') errorText.value = t('setup.err.already');
    else if (error.code === 'SETUP_TOKEN_INVALID') errorText.value = t('setup.err.token');
    else errorText.value = t('setup.err.failed');
    return;
  }

  await router.replace('/admin');
}
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

      <h1 class="text-xl font-semibold">{{ t('setup.title') }}</h1>
      <p class="mt-1 text-xs text-muted">{{ t('setup.desc') }}</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div v-if="setupRequiresToken">
          <label for="setup-token" class="mb-1 block text-xs font-medium text-muted">{{ t('setup.token') }}</label>
          <input
            id="setup-token"
            v-model="token"
            type="password"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
          <p class="mt-1 text-[11px] text-muted">{{ t('setup.tokenHint') }}</p>
        </div>

        <div>
          <label for="setup-password" class="mb-1 block text-xs font-medium text-muted">{{ t('setup.password') }}</label>
          <input
            id="setup-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
            :placeholder="t('pwd.placeholder')"
          />
        </div>

        <div>
          <label for="setup-confirm" class="mb-1 block text-xs font-medium text-muted">{{ t('setup.confirm') }}</label>
          <input
            id="setup-confirm"
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
        </div>

        <p v-if="errorText" role="alert" class="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {{ errorText }}
        </p>

        <button
          type="submit"
          :disabled="!canSubmit"
          class="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {{ submitting ? t('common.saving') : t('setup.submit') }}
        </button>
      </form>

      <p class="mt-6 rounded-control border border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
        {{ t('setup.note') }}
      </p>
    </div>
  </div>
</template>
