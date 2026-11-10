import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/** 构建后写入 version.json，供前端检测新版本 */
function versionFile(): Plugin {
  let outDir = path.resolve('web/dist');
  return {
    name: 'date-alert-version-file',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const payload = JSON.stringify({ v: Date.now().toString(36), at: new Date().toISOString() });
      fs.writeFileSync(path.resolve(outDir, 'version.json'), payload);
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), versionFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
});
