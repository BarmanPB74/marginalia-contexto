import './categorias.css';

/**
 * Paleta categórica de Stark (tokens --cat-*). Cada color tiene tres tonos en tokens.css:
 * base vívida (rellenos, puntos), «suave» (fondos) y «tinta» (texto legible sobre suave o superficie).
 */
export const CATEGORIAS = ['indigo', 'coral', 'cielo', 'ambar', 'esmeralda', 'fucsia', 'turquesa'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Color estable para un texto (nombre de categoría, de usuario…): el mismo texto, el mismo color. */
export function categoriaDe(texto: string): Categoria {
  let h = 0;
  for (const c of texto.trim().toLowerCase()) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return CATEGORIAS[h % CATEGORIAS.length] ?? 'indigo';
}

/** Hasta dos iniciales en mayúscula ("Ana María" → "AM"; "café" → "C"). */
export function inicialesDe(nombre: string, maximo = 2): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  return palabras
    .slice(0, maximo)
    .map((p) => [...p][0]?.toLocaleUpperCase('es') ?? '')
    .join('');
}
