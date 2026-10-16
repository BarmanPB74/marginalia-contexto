import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Envoltorio } from '../../core/almacen/boveda';

/**
 * Puentes con los plugins nativos de seguridad (ADR-014):
 * - `Boveda` (BovedaPlugin.java): envuelve la clave de las notas con Android Keystore.
 * - `Bloqueo` (BloqueoPlugin.java): pide huella, rostro o el PIN/patrón del teléfono.
 * En el navegador no existen: la app sigue con la clave v1 y sin bloqueo.
 */
interface PluginBoveda {
  envolver(o: { clave: string }): Promise<{ envuelta: string }>;
  desenvolver(o: { envuelta: string }): Promise<{ clave: string }>;
}

interface PluginBloqueo {
  disponible(): Promise<{ disponible: boolean }>;
  autenticar(o: { titulo: string; subtitulo: string }): Promise<void>;
  ocultarEnRecientes(o: { ocultar: boolean }): Promise<void>;
}

const Boveda = registerPlugin<PluginBoveda>('Boveda');
export const Bloqueo = registerPlugin<PluginBloqueo>('Bloqueo');

export const enTelefono = (): boolean => Capacitor.isNativePlatform();

export const envoltorioKeystore: Envoltorio = {
  envolver: async (clave) => (await Boveda.envolver({ clave })).envuelta,
  desenvolver: async (envuelta) => (await Boveda.desenvolver({ envuelta })).clave,
};

/**
 * Versión de escritorio (Windows, Electron, ADR-017): `escritorio/preload.cjs` expone
 * `window.stark.boveda`, que envuelve la clave con safeStorage (DPAPI de Windows, ligada a la
 * cuenta del usuario). En el navegador no existe y se sigue con la clave v1.
 */
interface PuenteEscritorio {
  boveda?: {
    disponible(): Promise<boolean>;
    envolver(clave: string): Promise<string>;
    desenvolver(envuelta: string): Promise<string>;
  };
}

export function envoltorioEscritorio(): Envoltorio | undefined {
  const boveda = (globalThis as { stark?: PuenteEscritorio }).stark?.boveda;
  if (!boveda) return undefined;
  return {
    envolver: async (clave) => {
      if (!(await boveda.disponible())) throw new Error('safeStorage no disponible');
      return boveda.envolver(clave);
    },
    desenvolver: (envuelta) => boveda.desenvolver(envuelta),
  };
}
