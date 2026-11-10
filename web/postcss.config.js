import { fileURLToPath } from 'node:url';

const config = fileURLToPath(new URL('./tailwind.config.ts', import.meta.url));

export default {
  plugins: {
    tailwindcss: { config },
    autoprefixer: {},
  },
};
