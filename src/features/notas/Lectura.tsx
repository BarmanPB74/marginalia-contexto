import { useMemo } from 'preact/hooks';
import { renderMarkdown } from '../../core/markdown/render';
import './Lectura.css';

/** Modo lectura: Markdown ya pintado. El HTML sale de `renderMarkdown`, que lo sanitiza. */
export function Lectura({ texto }: { texto: string }) {
  const html = useMemo(() => renderMarkdown(texto), [texto]);
  if (!texto.trim()) return <p class="lectura lectura--vacia">Nota vacía. Toca «Editar» para escribir.</p>;
  return <article class="lectura" dangerouslySetInnerHTML={{ __html: html }} />;
}
