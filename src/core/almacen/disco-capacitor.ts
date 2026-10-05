import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { Disco } from './almacen';

// Carpeta privada de la app (/data/data/<appId>/files): no pide permisos y otras apps no la leen.
const DIRECTORIO = Directory.Data;

async function existe(ruta: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path: ruta, directory: DIRECTORIO });
    return true;
  } catch {
    return false;
  }
}

/**
 * Disco del teléfono. No verificable en el entorno de Claude (no hay WebView):
 * ver "Probar en el teléfono" en ESTADO.md.
 */
export const discoCapacitor: Disco = {
  async leer(ruta) {
    if (!(await existe(ruta))) return null;
    const { data } = await Filesystem.readFile({ path: ruta, directory: DIRECTORIO, encoding: Encoding.UTF8 });
    return typeof data === 'string' ? data : await data.text();
  },

  async escribir(ruta, contenido) {
    await Filesystem.writeFile({
      path: ruta,
      data: contenido,
      directory: DIRECTORIO,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },

  async renombrar(origen, destino) {
    // En Android el plugin borra el destino y luego renombra (ion-android-filesystem 1.1.1).
    await Filesystem.rename({ from: origen, to: destino, directory: DIRECTORIO, toDirectory: DIRECTORIO });
  },

  async borrar(ruta) {
    if (await existe(ruta)) await Filesystem.deleteFile({ path: ruta, directory: DIRECTORIO });
  },

  async listar(carpeta) {
    if (!(await existe(carpeta))) return [];
    const { files } = await Filesystem.readdir({ path: carpeta, directory: DIRECTORIO });
    return files.filter((f) => f.type === 'file').map((f) => f.name);
  },
};
