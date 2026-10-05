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
export async function guardarExportado(
  nombre: string,
  contenido: string | Uint8Array<ArrayBuffer>,
  tipo: string,
  subcarpeta = '',
): Promise<string> {
  const ruta = [CARPETA_EXPORTAR, subcarpeta, nombre].filter(Boolean).join('/');
  if (Capacitor.isNativePlatform()) {
    const texto = typeof contenido === 'string';
    await Filesystem.writeFile({
      path: ruta,
      // Binario (ZIP): el puente de Capacitor lo lleva en Base64 y sin `encoding`
      data: texto ? contenido : aBase64(contenido),
      directory: Directory.Documents,
      ...(texto ? { encoding: Encoding.UTF8 } : {}),
      recursive: true,
    });
    return `Documentos/${ruta}`;
  }
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(
    new Blob([contenido], { type: typeof contenido === 'string' ? `${tipo};charset=utf-8` : tipo }),
  );
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Descargas/${nombre}`;
}

function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}
