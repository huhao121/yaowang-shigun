import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 8201, host: '127.0.0.1', strictPort: true },
  preview: { port: 8201, host: '127.0.0.1', strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
