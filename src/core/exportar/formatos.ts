import { renderMarkdown } from '../markdown/render';
import { extracto } from '../notas/extracto';
import { escribirNota, type Nota } from '../notas/nota';

/**
 * Exportar = sacar una nota del cifrado a un archivo que cualquiera puede leer (ADR-008).
 * Funciones puras: nota → texto del archivo. Guardarlo es cosa de `guardar.ts`.
 */
export type Formato = 'md' | 'txt' | 'html';

export const FORMATOS: readonly { id: Formato; nombre: string; tipo: string }[] = [
  { id: 'md', nombre: 'Markdown (.md)', tipo: 'text/markdown' },
  { id: 'txt', nombre: 'Texto (.txt)', tipo: 'text/plain' },
  { id: 'html', nombre: 'Página web (.html)', tipo: 'text/html' },
];

/** "Reunión: 5/10 ¿ok?" → "Reunión 5-10 ok.md". Sin rutas, sin caracteres raros, ≤ 60 letras. */
export function nombreArchivo(titulo: string, formato: Formato): string {
  const limpio = titulo
    .normalize('NFC')
    .replace(/[/\\]/g, '-')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s]+$/g, '')
    .slice(0, 60)
    .trim();
  return `${limpio || 'nota'}.${formato}`;
}

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export function exportar(nota: Nota, formato: Formato): string {
  if (formato === 'md') return escribirNota(nota);
  if (formato === 'txt') {
    const cuerpo = extracto(nota.cuerpo, Infinity);
    return `${nota.titulo}\n${'='.repeat(Math.min(nota.titulo.length, 60) || 1)}\n\n${cuerpo}\n`;
  }
  // HTML autónomo: el cuerpo pasa por el mismo render sanitizado del modo lectura.
  // Sin colores propios: el navegador usa los suyos (claro u oscuro).
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Marginalia">
<title>${escapar(nota.titulo)}</title>
<style>
  :root { color-scheme: light dark; }
  body { max-width: 68ch; margin: 2rem auto; padding: 0 1rem; font: 17px/1.6 Georgia, serif; }
  h1, h2, h3 { line-height: 1.25; }
  pre, code { font-family: ui-monospace, monospace; }
  pre { overflow-x: auto; }
  li.tarea { list-style: none; }
</style>
</head>
<body>
<h1>${escapar(nota.titulo)}</h1>
${renderMarkdown(nota.cuerpo)}
</body>
</html>
`;
}
