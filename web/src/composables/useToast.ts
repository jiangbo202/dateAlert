import { ref } from 'vue';

const message = ref<string | null>(null);
let timer: number | undefined;

export function showToast(text: string, duration = 2200): void {
  message.value = text;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    message.value = null;
  }, duration);
}

export function useToast() {
  return { message, showToast };
}
