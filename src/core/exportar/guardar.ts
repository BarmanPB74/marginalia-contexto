import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

/** Carpeta pública donde quedan los archivos exportados: Documentos/Marginalia. */
export const CARPETA_EXPORTAR = 'Marginalia';

/**
 * Guarda un archivo exportado fuera de la app, ya legible.
 * - Teléfono: Documentos/Marginalia/<nombre> (Android 11+ no pide permisos para archivos propios).
 * - Navegador: lo descarga.
 * Devuelve dónde quedó, para decírselo a la persona.
 */
export async function guardarExportado(nombre: string, contenido: string, tipo: string, subcarpeta = ''): Promise<string> {
  const ruta = [CARPETA_EXPORTAR, subcarpeta, nombre].filter(Boolean).join('/');
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: ruta,
      data: contenido,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return `Documentos/${ruta}`;
  }
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Descargas/${nombre}`;
}
