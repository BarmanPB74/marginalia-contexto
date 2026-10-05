import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { crearAlmacen } from '../../core/almacen/almacen';
import { discoCapacitor } from '../../core/almacen/disco-capacitor';
import { RepositorioNotas } from '../../core/notas/repositorio';

const Contexto = createContext<RepositorioNotas | null>(null);

/** Las pruebas pasan aquí un repositorio en memoria. */
export const ProveedorNotas = Contexto.Provider;

let predeterminado: RepositorioNotas | undefined;

/**
 * Repositorio de la app. El mismo código en todas partes: archivos de la carpeta
 * privada en el APK, IndexedDB en el navegador (versión web de @capacitor/filesystem).
 */
export function useRepositorio(): RepositorioNotas {
  return useContext(Contexto) ?? (predeterminado ??= new RepositorioNotas(crearAlmacen(discoCapacitor)));
}
