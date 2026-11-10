import { fileURLToPath } from 'node:url';
import type { Config } from 'tailwindcss';

const dir = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default {
  content: [dir('./index.html'), dir('./src/**/*.{vue,ts}')],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'Noto Sans TC',
          'sans-serif',
        ],
      },
      colors: {
        app: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        main: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        line: 'var(--color-border)',
        accent: '#2563EB',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
} satisfies Config;
