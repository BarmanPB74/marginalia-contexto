import { sinCodigo } from '../parser/codigo';
import type { Nota } from './nota';

/**
 * Fechas de una nota para el Calendario (docs/FORMATO_NOTAS.md):
 * - `fecha:` en el frontmatter (una o una lista), y
 * - `@AAAA-MM-DD` (o `@AAAA-MM-DD HH:mm`) en el texto, fuera de bloques y líneas de código.
 * Las fechas imposibles (`@2026-02-30`) se ignoran. Todo son funciones puras.
 */

/** "2026-10-07" */
export type Dia = string;

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
// Precedida de inicio, espacio o signo de apertura; no pegada a letras (correo@2026… no cuenta).
export const FECHA_EN_TEXTO = /(^|[\s([{¡¿"'«])@(\d{4}-\d{2}-\d{2})(?:[ T]([01]\d|2[0-3]):([0-5]\d))?(?![\d-])/g;

export function esDiaValido(texto: string): boolean {
  const m = DIA.exec(texto);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (me < 1 || me > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(a, me, 0)).getUTCDate();
}

/** Fecha local del dispositivo → "AAAA-MM-DD". */
export function diaDe(fecha: Date): Dia {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

export function fechasDeTexto(texto: string): Dia[] {
  const dias = new Set<Dia>();
  for (const m of sinCodigo(texto).matchAll(FECHA_EN_TEXTO)) {
    const dia = m[2];
    if (dia && esDiaValido(dia)) dias.add(dia);
  }
  return [...dias].sort();
}

function fechasDelFrontmatter(valor: unknown): Dia[] {
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().slice(0, 10))
    .filter(esDiaValido);
}

/** Todos los días en los que aparece la nota, sin repetir y en orden. */
export function fechasDeNota(nota: Pick<Nota, 'extra' | 'cuerpo'>): Dia[] {
  return [...new Set([...fechasDelFrontmatter(nota.extra['fecha']), ...fechasDeTexto(nota.cuerpo)])].sort();
}

/** Índice día → notas de ese día (cada lista ordenada por título). */
export function notasPorDia(notas: readonly Nota[]): Map<Dia, Nota[]> {
  const indice = new Map<Dia, Nota[]>();
  for (const nota of notas) {
    for (const dia of fechasDeNota(nota)) {
      const lista = indice.get(dia) ?? [];
      lista.push(nota);
      indice.set(dia, lista);
    }
  }
  for (const lista of indice.values()) lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  return indice;
}

export interface CeldaMes {
  dia: Dia;
  numero: number;
  /** del mes anterior o siguiente, para completar la cuadrícula */
  fuera: boolean;
}

/** 6 semanas × 7 días, empezando en lunes, que contienen el mes (`mes` de 0 a 11). */
export function cuadriculaMes(anio: number, mes: number): CeldaMes[] {
  const primero = new Date(anio, mes, 1);
  const desdeLunes = (primero.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const fecha = new Date(anio, mes, 1 - desdeLunes + i);
    return { dia: diaDe(fecha), numero: fecha.getDate(), fuera: fecha.getMonth() !== mes };
  });
}

/** "2026-10-07" → "miércoles, 7 de octubre de 2026" */
export function diaLargo(dia: Dia): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(a, m - 1, d).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function nombreMes(anio: number, mes: number): string {
  const texto = new Date(anio, mes, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
