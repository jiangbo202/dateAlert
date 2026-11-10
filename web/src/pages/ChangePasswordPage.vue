<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import LanguageMenu from '../components/LanguageMenu.vue';
import { useSession } from '../composables/useSession';
import { useTheme } from '../composables/useTheme';
import { t } from '../i18n';

const router = useRouter();
const { mustChangePassword, changePassword, logout } = useSession();
const { toggleTheme } = useTheme();

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const submitting = ref(false);
const errorText = ref('');
const fieldError = ref('');

const strength = computed(() => {
  const value = newPassword.value;
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
});

const strengthText = computed(() => t(`pwd.strength.${strength.value}`));

async function submit(): Promise<void> {
  errorText.value = '';
  fieldError.value = '';

  if (newPassword.value.length < 12 || newPassword.value.length > 64) {
    fieldError.value = t('pwd.err.length');
    return;
  }
  if (!/[A-Za-z]/.test(newPassword.value) || !/[0-9]/.test(newPassword.value)) {
    fieldError.value = t('pwd.err.chars');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    fieldError.value = t('pwd.err.mismatch');
    return;
  }
  if (newPassword.value === oldPassword.value) {
    fieldError.value = t('pwd.err.same');
    return;
  }

  submitting.value = true;
  const error = await changePassword(oldPassword.value, newPassword.value);
  submitting.value = false;

  if (error) {
    if (error.code === 'PASSWORD_WRONG') errorText.value = t('pwd.err.oldWrong');
    else if (error.code === 'VALIDATION_FAILED') errorText.value = t('pwd.err.invalid');
    else errorText.value = t('pwd.err.failed');
    return;
  }

  await router.replace('/admin');
}

async function signOut(): Promise<void> {
  await logout();
  await router.replace('/');
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
          <button
            type="button"
            class="rounded-control px-3 py-1.5 text-xs text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
            @click="signOut"
          >
            {{ t('nav.logout') }}
          </button>
        </div>
      </div>

      <div
        v-if="mustChangePassword"
        class="mb-4 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        {{ t('pwd.banner') }}
      </div>

      <h1 class="text-xl font-semibold">{{ mustChangePassword ? t('pwd.titleForced') : t('pwd.title') }}</h1>
      <p class="mt-1 text-xs text-muted">{{ t('pwd.desc') }}</p>
      <RouterLink
        v-if="!mustChangePassword"
        to="/admin"
        class="mt-3 inline-block text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
      >
        ← {{ t('admin.badge') }}
      </RouterLink>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label for="old" class="mb-1 block text-xs font-medium text-muted">{{ t('pwd.old') }}</label>
          <input
            id="old"
            v-model="oldPassword"
            type="password"
            autocomplete="current-password"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
        </div>

        <div>
          <label for="new" class="mb-1 block text-xs font-medium text-muted">{{ t('pwd.new') }}</label>
          <input
            id="new"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
            :placeholder="t('pwd.placeholder')"
          />
          <div v-if="newPassword" class="mt-2 flex items-center gap-2">
            <div class="flex flex-1 gap-1">
              <span
                v-for="n in 4"
                :key="n"
                class="h-1 flex-1 rounded-full"
                :class="n <= strength ? 'bg-accent' : 'bg-black/10 dark:bg-white/15'"
              />
            </div>
            <span class="text-[11px] text-muted">{{ strengthText }}</span>
          </div>
        </div>

        <div>
          <label for="confirm" class="mb-1 block text-xs font-medium text-muted">{{ t('pwd.confirm') }}</label>
          <input
            id="confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
        </div>

        <p v-if="fieldError" role="alert" class="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {{ fieldError }}
        </p>
        <p v-else-if="errorText" role="alert" class="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {{ errorText }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {{ submitting ? t('common.saving') : t('common.save') }}
        </button>
      </form>
    </div>
  </div>
</template>
