import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.barmanpb74.appnoti',
  appName: 'Bar Box',
  webDir: 'dist',
  android: {
    // Nunca mezclar http dentro de la app (docs/SEGURIDAD.md §3).
    allowMixedContent: false,
  },
};

export default config;
