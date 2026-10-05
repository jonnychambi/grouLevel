/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * BASE_PATH controla el subdirectorio de publicación.
 * GitHub Pages de proyecto → "/<repo>/". Dominio propio → "/".
 */
const base = process.env.BASE_PATH ?? '/grouLevel/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  },
  test: {
    environment: 'node'
  }
});
