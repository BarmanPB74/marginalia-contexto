import type { NombreIcono } from '../ui/Icono';

export type IdSeccion = 'notas' | 'calendario' | 'musica' | 'ajustes';
export type Ruta = IdSeccion | 'galeria';

interface Seccion {
  id: IdSeccion;
  etiqueta: string;
  icono: NombreIcono;
}

/** Las 4 secciones de la barra inferior, en orden. */
export const SECCIONES: readonly Seccion[] = [
  { id: 'notas', etiqueta: 'Notas', icono: 'notas' },
  { id: 'calendario', etiqueta: 'Calendario', icono: 'calendario' },
  { id: 'musica', etiqueta: 'Música', icono: 'musica' },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: 'ajustes' },
];

/**
 * Ruta a partir del hash (#/calendario). El hash funciona igual en la WebView, en preview y en el navegador.
 * Lo vacío o desconocido abre Notas, la pantalla principal.
 */
export function rutaActual(hash: string): Ruta {
  const nombre = hash.replace(/^#\//, '');
  if (nombre === 'galeria') return 'galeria';
  return SECCIONES.find((s) => s.id === nombre)?.id ?? 'notas';
}
