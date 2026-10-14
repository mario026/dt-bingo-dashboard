import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [vue(), tailwindcss()],
  server: { host: '127.0.0.1' },
  build: { chunkSizeWarningLimit: 1100 },
});
