import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { crearAlmacen, type Almacen } from '../../core/almacen/almacen';
import { cifrarPendientes, claveDelDispositivo, discoCifrado } from '../../core/almacen/cifrado';
import { discoCapacitor } from '../../core/almacen/disco-capacitor';
import { RepositorioNotas } from '../../core/notas/repositorio';

const Contexto = createContext<RepositorioNotas | null>(null);

/** Las pruebas pasan aquí un repositorio en memoria. */
export const ProveedorNotas = Contexto.Provider;

let predeterminado: RepositorioNotas | undefined;

/**
 * Almacén de la app: archivos de la carpeta privada en el APK (IndexedDB en el navegador),
 * cifrados con la clave del dispositivo (ADR-008). Antes de la primera operación cifra las
 * notas que aún estén en claro, para que nada se lea ni se escriba a medio migrar.
 */
function almacenDeLaApp(): Almacen {
  const almacen = crearAlmacen(discoCifrado(discoCapacitor, claveDelDispositivo));
  const listo = cifrarPendientes(discoCapacitor, (r, t) => almacen.escribir(r, t), 'notas').catch(() => 0);
  return {
    leer: async (ruta) => (await listo, almacen.leer(ruta)),
    escribir: async (ruta, contenido) => (await listo, almacen.escribir(ruta, contenido)),
    borrar: async (ruta) => (await listo, almacen.borrar(ruta)),
    listar: async (carpeta) => (await listo, almacen.listar(carpeta)),
  };
}

/** Repositorio de la app. El mismo código en el teléfono y en el navegador. */
export function useRepositorio(): RepositorioNotas {
  return useContext(Contexto) ?? (predeterminado ??= new RepositorioNotas(almacenDeLaApp()));
}
