import { esDiaValido } from '../core/notas/fechas';
import { esUlid } from '../core/notas/ulid';
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
  const nombre = hash.replace(/^#\//, '').split(/[/?]/)[0];
  if (nombre === 'galeria') return 'galeria';
  return SECCIONES.find((s) => s.id === nombre)?.id ?? 'notas';
}

/** `#/notas/<id>` → id de la nota abierta; cualquier otra cosa → null. */
export function idNotaEnRuta(hash: string): string | null {
  const [seccion, id, ...resto] = hash.replace(/^#\//, '').split('/');
  return seccion === 'notas' && id !== undefined && resto.length === 0 && esUlid(id) ? id : null;
}

/** `#/calendario/AAAA-MM-DD` → ese día; cualquier otra cosa → null. */
export function diaEnRuta(hash: string): string | null {
  const [seccion, dia, ...resto] = hash.replace(/^#\//, '').split('/');
  return seccion === 'calendario' && dia !== undefined && resto.length === 0 && esDiaValido(dia) ? dia : null;
}

/** `#/notas?etiqueta=estudio` → "estudio" (lista de Notas filtrada); si no, null. */
export function etiquetaEnRuta(hash: string): string | null {
  const [ruta, consulta = ''] = hash.replace(/^#\//, '').split('?');
  if (ruta !== 'notas') return null;
  try {
    const etiqueta = new URLSearchParams(consulta).get('etiqueta')?.trim();
    // Una codificación rota llega como "�": mejor sin filtro que filtrar por basura
    return etiqueta && !etiqueta.includes('\uFFFD') ? etiqueta.slice(0, 64) : null;
  } catch {
    return null;
  }
}

/** `#/musica?yt=ID&t=99` → la canción que hay que poner (desde una etiqueta ♪); si no, null. */
export function cancionEnRuta(hash: string): { yt: string; t: number } | null {
  const [ruta, consulta = ''] = hash.replace(/^#\//, '').split('?');
  if (ruta !== 'musica') return null;
  const p = new URLSearchParams(consulta);
  const yt = p.get('yt') ?? '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(yt)) return null;
  const t = Number(p.get('t') ?? 0);
  return { yt, t: Number.isInteger(t) && t >= 0 && t <= 86400 ? t : 0 };
}
