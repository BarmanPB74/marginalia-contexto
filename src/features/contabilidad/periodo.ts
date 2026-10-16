import { diaDe, type Dia } from '../../core/notas/fechas';
import type { Periodo } from '../../core/negocio';

/** Atajos de período de la pantalla de Contabilidad. */
export type TipoPeriodo = 'hoy' | 'semana' | 'mes' | 'rango';

export const TIPOS_PERIODO: readonly { valor: TipoPeriodo; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'rango', etiqueta: 'Rango' },
];

/** Desde el principio de los tiempos: «contabilidad completa». */
export const DESDE_SIEMPRE: Dia = '2000-01-01';

/**
 * Días locales del atajo, inclusive. La semana empieza el lunes (como el Calendario) y el mes
 * el día 1; ambos llegan hasta hoy. `rango` usa los días elegidos (ordenados).
 */
export function periodoDe(tipo: TipoPeriodo, hoy: Date, rango?: { desde: Dia; hasta: Dia }): Periodo {
  const dia = diaDe(hoy);
  switch (tipo) {
    case 'hoy':
      return { desde: dia, hasta: dia };
    case 'semana': {
      const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
      return { desde: diaDe(lunes), hasta: dia };
    }
    case 'mes':
      return { desde: diaDe(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: dia };
    case 'rango': {
      const a = rango?.desde ?? dia;
      const b = rango?.hasta ?? dia;
      return a <= b ? { desde: a, hasta: b } : { desde: b, hasta: a };
    }
  }
}

/** Todo el registro hasta hoy. */
export function periodoCompleto(hoy: Date): Periodo {
  return { desde: DESDE_SIEMPRE, hasta: diaDe(hoy) };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-10-16' → '16 oct 2026' (corto, para botones y tablas). */
export function diaCorto(dia: Dia): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return `${d} ${MESES[m - 1] ?? ''} ${a}`;
}

/** Instante ISO con desfase local ('2026-10-16T22:10:00-05:00') → '16 oct 2026, 22:10'. */
export function momentoCorto(iso: string): string {
  return `${diaCorto(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
}
