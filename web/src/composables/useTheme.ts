import { ref } from 'vue';

export type ThemeMode = 'light' | 'dark';

const theme = ref<ThemeMode>('light');

export function applyTheme(next: ThemeMode, persist = true): void {
  theme.value = next;
  document.documentElement.dataset.theme = next;
  if (persist) localStorage.setItem('theme', next);
}

export function initTheme(): void {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light', false);
}

export function useTheme() {
  return {
    theme,
    toggleTheme: () => applyTheme(theme.value === 'dark' ? 'light' : 'dark'),
  };
}
