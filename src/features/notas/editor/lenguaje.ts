import { defineLanguageFacet, HighlightStyle, Language, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { GFM, parser } from '@lezer/markdown';

/*
 * Markdown para CodeMirror sin @codemirror/lang-markdown: ese paquete arrastra los analizadores
 * de HTML, CSS y JavaScript (cientos de kB) para colorear HTML incrustado, que aquí no se usa.
 * @lezer/markdown ya trae el analizador con GFM y sus etiquetas de coloreado.
 */
const markdown = new Language(defineLanguageFacet(), parser.configure(GFM), [], 'markdown');

// Solo tokens del diseño: las marcas (**, #, -) en tinta suave para que el texto respire.
const estilo = HighlightStyle.define([
  { tag: t.heading1, fontSize: 'var(--texto-l)', fontWeight: '600' },
  { tag: [t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '600' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--acento)' },
  { tag: t.monospace, fontFamily: 'var(--letra-codigo)', fontSize: '0.92em' },
  { tag: t.quote, color: 'var(--tinta-suave)', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--tinta-suave)' },
]);

export const lenguajeMarkdown: Extension = [markdown, syntaxHighlighting(estilo)];
