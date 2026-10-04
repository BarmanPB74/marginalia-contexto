/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Sin mapas de código en producción: no exponer el código fuente dentro del APK.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Procesar CSS: sin esto Vitest entrega los .css (también con ?raw) vacíos y las
    // pruebas de tokens pasarían en falso.
    css: true,
  },
});
