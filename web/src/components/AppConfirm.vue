<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useConfirm } from '../composables/useConfirm';
import { t } from '../i18n';

const { state, settle } = useConfirm();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.value.open) settle(false);
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      enter-active-class="transition duration-150"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150"
    >
      <div
        v-if="state.open"
        class="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 px-4"
        @click.self="settle(false)"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-label="state.title"
          class="w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-card-hover"
        >
          <h2 class="text-base font-semibold">{{ state.title }}</h2>
          <p v-if="state.message" class="mt-2 whitespace-pre-line text-sm text-muted">{{ state.message }}</p>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-control px-3 py-1.5 text-sm text-muted transition hover:bg-black/5 dark:hover:bg-white/10"
              @click="settle(false)"
            >
              {{ state.cancelText || t('common.cancel') }}
            </button>
            <button
              type="button"
              :class="[
                'rounded-control px-3 py-1.5 text-sm font-medium text-white transition',
                state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-blue-700',
              ]"
              @click="settle(true)"
            >
              {{ state.confirmText || t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
