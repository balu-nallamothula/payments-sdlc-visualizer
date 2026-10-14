import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_TARGET || 'http://localhost:4317';

// Build with relative asset URLs ("./assets/…") so the app works under any mount
// path (served at "/" standalone, or under a reverse-proxy sub-path like Nova's
// /drops/<name>/ where the <base href> resolves them). Dev stays at "/".
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: {
    port: 5317,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
}));
