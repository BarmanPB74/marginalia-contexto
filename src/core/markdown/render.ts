import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

/**
 * Markdown → HTML seguro para el modo lectura (CLAUDE.md regla 6).
 * Dos barreras:
 * 1. markdown-it con `html: false`: el HTML escrito en la nota se muestra como texto,
 *    y su `validateLink` rechaza javascript:, vbscript:, file: y data: (salvo imágenes raster).
 * 2. DOMPurify sobre el resultado, por si alguna regla futura deja pasar algo.
 */
const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });

// Tareas GFM: "- [ ] texto" / "- [x] texto" al inicio de un elemento de lista → casilla de solo lectura.
// Se hace sobre los tokens (no con regex sobre el HTML), así el texto de la tarea sigue escapado.
const TAREA = /^\[([ xX])\][ \t]/;
md.core.ruler.after('inline', 'tareas', (estado) => {
  const tokens = estado.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const enLista = tokens[i - 2]?.type === 'list_item_open' && tokens[i - 1]?.type === 'paragraph_open';
    const linea = tokens[i];
    const primero = linea?.children?.[0];
    if (!enLista || linea?.type !== 'inline' || !primero || primero.type !== 'text') continue;
    const marca = TAREA.exec(primero.content);
    if (!marca) continue;
    primero.content = primero.content.slice(marca[0].length);
    const casilla = new estado.Token('html_inline', '', 0);
    casilla.content = `<input type="checkbox" disabled${marca[1] === ' ' ? '' : ' checked'}> `;
    linea.children?.unshift(casilla);
    tokens[i - 2]?.attrJoin('class', 'tarea');
  }
});

// Enlaces externos: fuera de la app (Capacitor abre el navegador del sistema) y sin `window.opener`.
DOMPurify.addHook('afterSanitizeAttributes', (nodo) => {
  if (nodo.tagName === 'A' && /^https?:/i.test(nodo.getAttribute('href') ?? '')) {
    nodo.setAttribute('target', '_blank');
    nodo.setAttribute('rel', 'noopener noreferrer');
  }
});

const PERMITIDO = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'strong', 'em', 's', 'ul', 'ol', 'li', 'a', 'img', 'input',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'type', 'checked', 'disabled', 'class', 'start', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

export function renderMarkdown(texto: string): string {
  let html: string;
  try {
    html = md.render(texto);
  } catch {
    // Entrada patológica (p. ej. anidación extrema): mejor texto plano que romper la pantalla.
    html = `<p>${md.utils.escapeHtml(texto)}</p>`;
  }
  return DOMPurify.sanitize(html, PERMITIDO);
}
