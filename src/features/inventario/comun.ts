/**
 * Utilidades compartidas por Inventario, Compras y Gastos (mismo agente, mismas reglas).
 */
import { useEffect, useState } from 'preact/hooks';
import { NumeroInvalido, ReglaRota, type EstadoNegocio, type Milesimas, type Unidad } from '../../core/negocio';
import { ErrorImportacion } from '../../core/negocio/importar';
import { diaDe } from '../../core/notas/fechas';
import { ErrorAdjunto } from '../adjuntos/adjuntos';

/** Hash actual (#/inventario?producto=…), vivo: cambia con la navegación. */
export function useHash(): string {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const alCambiar = () => setHash(location.hash);
    const ventana = window;
    ventana.addEventListener('hashchange', alCambiar);
    return () => ventana.removeEventListener('hashchange', alCambiar);
  }, []);
  return hash;
}

/** ¿La ventana mide al menos `px` de ancho? Se actualiza al girar o cambiar el tamaño. */
export function useAncho(px: number): boolean {
  const consulta = `(min-width: ${px}px)`;
  const [si, setSi] = useState(() => typeof matchMedia === 'function' && matchMedia(consulta).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(consulta);
    const alCambiar = () => setSi(m.matches);
    m.addEventListener('change', alCambiar);
    return () => m.removeEventListener('change', alCambiar);
  }, [consulta]);
  return si;
}

/** Parámetros de la consulta del hash: `#/compras?factura=X` → { factura: 'X' }. */
export function consultaDe(hash: string): URLSearchParams {
  const i = hash.indexOf('?');
  try {
    return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
  } catch {
    return new URLSearchParams();
  }
}

/** Navega dentro de la app (deja historial: el botón atrás de Android vuelve). */
export function ir(hash: string): void {
  if (location.hash !== hash) location.hash = hash;
}

/** Mensaje para la persona: las reglas del núcleo ya vienen en español y listas para mostrar. */
export function mensajeDe(e: unknown, siNo = 'No se pudo guardar. Prueba otra vez.'): string {
  if (e instanceof ReglaRota || e instanceof NumeroInvalido || e instanceof ErrorImportacion || e instanceof ErrorAdjunto) {
    return e.message;
  }
  return siNo;
}

/** Abreviatura corta de la unidad, para sufijos y existencias («12 und», «1,5 kg»). */
export const ABREV_UNIDAD: Readonly<Record<Unidad, string>> = { unidad: 'und', g: 'g', kg: 'kg', ml: 'ml', L: 'L' };
export const NOMBRE_UNIDAD: Readonly<Record<Unidad, string>> = {
  unidad: 'Unidad',
  g: 'Gramos',
  kg: 'Kilos',
  ml: 'Mililitros',
  L: 'Litros',
};

export type EstadoStock = 'negativo' | 'agotado' | 'bajo' | 'ok';

/** Estado de existencias: negativo (< 0), agotado (0), bajo (≤ mínimo), ok. */
export function estadoStock(stock: Milesimas, minimo: Milesimas | null): EstadoStock {
  if (stock < 0) return 'negativo';
  if (stock === 0) return 'agotado';
  if (minimo !== null && stock <= minimo) return 'bajo';
  return 'ok';
}

export const NOMBRE_ESTADO_STOCK: Readonly<Record<Exclude<EstadoStock, 'ok'>, string>> = {
  negativo: 'Negativo',
  agotado: 'Agotado',
  bajo: 'Bajo mínimo',
};

export function hoy(): string {
  return diaDe(new Date());
}

/** «16 oct 2026». */
export function fechaCorta(dia: string): string {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number) as [number, number, number];
  if (!a || !m || !d) return dia;
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** «16 oct 2026, 10:05» a partir de un ISO con zona. */
export function fechaHora(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return iso;
  return f.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function nombreUsuario(estado: EstadoNegocio, id: string): string {
  return estado.usuarios[id]?.nombre ?? '—';
}

/** Comparación sin tildes ni mayúsculas, para buscar. */
export function normal(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim();
}
