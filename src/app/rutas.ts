import { esDiaValido } from '../core/notas/fechas';
import { esUlid } from '../core/notas/ulid';
import type { NombreIcono } from '../ui/Icono';

/**
 * Stark (ADR-015): inventario y ventas primero; notas y calendario quedan como bitácora.
 * `SECCIONES` son las 5 de la barra (o del riel lateral en pantallas anchas); el resto se abre
 * desde «Más». Todas son rutas por hash (#/vender…).
 */
export type IdSeccion =
  | 'inicio'
  | 'mesas'
  | 'reservas'
  | 'vender'
  | 'inventario'
  | 'notas'
  | 'mas'
  | 'caja'
  | 'compras'
  | 'gastos'
  | 'contabilidad'
  | 'usuarios'
  | 'calendario'
  | 'ajustes';
export type Ruta = IdSeccion | 'galeria';

interface Seccion {
  id: IdSeccion;
  etiqueta: string;
  icono: NombreIcono;
}

/** Las 5 secciones de la navegación principal, en orden. */
export const SECCIONES: readonly Seccion[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio' },
  { id: 'mesas', etiqueta: 'Mesas', icono: 'mesa' },
  { id: 'vender', etiqueta: 'Vender', icono: 'vender' },
  { id: 'inventario', etiqueta: 'Inventario', icono: 'inventario' },
  { id: 'mas', etiqueta: 'Más', icono: 'mas' },
];

/** Lo que se abre desde «Más», agrupado. */
export const OTRAS: readonly Seccion[] = [
  { id: 'reservas', etiqueta: 'Reservas y clientes', icono: 'calendario' },
  { id: 'notas', etiqueta: 'Bitácora', icono: 'notas' },
  { id: 'caja', etiqueta: 'Caja', icono: 'caja' },
  { id: 'compras', etiqueta: 'Compras y facturas', icono: 'factura' },
  { id: 'gastos', etiqueta: 'Gastos', icono: 'gasto' },
  { id: 'contabilidad', etiqueta: 'Contabilidad', icono: 'contabilidad' },
  { id: 'usuarios', etiqueta: 'Usuarios', icono: 'usuarios' },
  { id: 'calendario', etiqueta: 'Calendario', icono: 'calendario' },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: 'ajustes' },
];

/**
 * Ruta a partir del hash (#/calendario). El hash funciona igual en la WebView, en preview y en el navegador.
 * Lo vacío o desconocido abre Inicio, la pantalla principal.
 */
export function rutaActual(hash: string): Ruta {
  const nombre = hash.replace(/^#\//, '').split(/[/?]/)[0];
  if (nombre === 'galeria') return 'galeria';
  return [...SECCIONES, ...OTRAS].find((s) => s.id === nombre)?.id ?? 'inicio';
}

/** `#/mesas?mesa=<id>` → la mesa abierta (su cuenta); cualquier otra cosa → null. */
export function mesaEnRuta(hash: string): string | null {
  const [ruta, consulta = ''] = hash.replace(/^#\//, '').split('?');
  if (ruta !== 'mesas') return null;
  const id = new URLSearchParams(consulta).get('mesa');
  return id !== null && esUlid(id) ? id : null;
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
