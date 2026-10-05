/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * BASE_PATH controla el subdirectorio de publicación.
 * Dominio propio / Vercel (por defecto) → "/". GitHub Pages de proyecto → "/<repo>/".
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    // El chunk del catálogo (JSON) solo se descarga como respaldo si /api/catalog no responde.
    chunkSizeWarningLimit: 1100,
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
