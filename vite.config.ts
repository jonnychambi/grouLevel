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
        // Solo React y el router van al chunk compartido; el resto (p. ej. el lector de Excel
        // del administrador) queda en el chunk de la página que lo usa.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor';
        }
      }
    }
  },
  test: {
    environment: 'node'
  }
});
