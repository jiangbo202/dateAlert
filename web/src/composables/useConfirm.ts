import { ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

const state = ref<ConfirmState>({ open: false, title: '' });
let resolver: ((value: boolean) => void) | null = null;

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    resolver = resolve;
    state.value = { open: true, ...options };
  });
}

export function settle(value: boolean): void {
  state.value = { ...state.value, open: false };
  resolver?.(value);
  resolver = null;
}

export function useConfirm() {
  return { state, confirm, settle };
}
