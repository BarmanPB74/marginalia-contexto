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
