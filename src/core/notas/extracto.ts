/**
 * Vista previa de una nota en texto plano (tarjetas y resultados de búsqueda). No pinta HTML:
 * quita las marcas de Markdown más comunes y deja el texto, así nada de la nota se interpreta.
 */
export function extracto(cuerpo: string, maximo = 280): string {
  const texto = cuerpo
    .replace(/^[ \t]{0,3}(`{3,}|~{3,}).*$/gm, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+/gm, '☐ ')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/^[ \t]*>[ \t]?(\[![a-z]+\][ \t]*)?/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return texto.length > maximo ? `${texto.slice(0, maximo).trimEnd()}…` : texto;
}

const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const PASOS: [Intl.RelativeTimeFormatUnit, number][] = [
  // unidad y cuántas de ella hacen la siguiente
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
];

/** "hace 5 minutos", "ayer", "hace 3 semanas"… a partir de una fecha ISO. */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  let valor = (fecha.getTime() - ahora.getTime()) / 1000;
  if (Math.abs(valor) < 45) return 'ahora mismo';
  valor /= 60;
  for (const [unidad, siguiente] of PASOS) {
    if (Math.round(Math.abs(valor)) < siguiente || unidad === 'year') return RELATIVO.format(Math.round(valor), unidad);
    valor /= siguiente;
  }
  return '';
}
