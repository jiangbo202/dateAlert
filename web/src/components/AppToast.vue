<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { message } = useToast();
</script>

<template>
  <Transition
    enter-from-class="opacity-0 translate-y-2"
    enter-active-class="transition duration-200"
    leave-to-class="opacity-0 translate-y-2"
    leave-active-class="transition duration-150"
  >
    <div
      v-if="message"
      role="status"
      aria-live="polite"
      class="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-slate-900/90 px-4 py-2 text-center text-sm text-white shadow-lg"
    >
      {{ message }}
    </div>
  </Transition>
</template>
