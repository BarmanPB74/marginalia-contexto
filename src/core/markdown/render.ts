import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { leerHrefCancion, rutaCancion } from '../musica/etiqueta';
import { esDiaValido, FECHA_EN_TEXTO } from '../notas/fechas';
import { ETIQUETA_EN_TEXTO, MAX_ETIQUETA } from '../parser/parser';

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

type Enlazador = (m: RegExpMatchArray) => { href: string; clase: string } | null;

/**
 * Convierte en enlaces internos lo que encuentra `patron` en el texto (grupo 1 = lo que va
 * antes, sin enlazar). Trabaja sobre los tokens: el código (en línea o en bloque) no son
 * tokens de texto, así que ahí no se convierte nada; tampoco dentro de un enlace.
 */
function regla(nombre: string, patron: RegExp, enlazar: Enlazador) {
  md.core.ruler.push(nombre, (estado) => {
    for (const bloque of estado.tokens) {
      if (bloque.type !== 'inline' || !bloque.children) continue;
      const nuevos: typeof bloque.children = [];
      let enEnlace = 0;
      for (const token of bloque.children) {
        if (token.type === 'link_open') enEnlace++;
        if (token.type === 'link_close') enEnlace--;
        if (token.type !== 'text' || enEnlace > 0) {
          nuevos.push(token);
          continue;
        }
        let ultimo = 0;
        for (const m of token.content.matchAll(patron)) {
          const destino = enlazar(m);
          if (!destino) continue;
          const inicio = (m.index ?? 0) + (m[1]?.length ?? 0);
          const fin = (m.index ?? 0) + m[0].length;
          const antes = new estado.Token('text', '', 0);
          antes.content = token.content.slice(ultimo, inicio);
          const abrir = new estado.Token('link_open', 'a', 1);
          abrir.attrs = [
            ['href', destino.href],
            ['class', destino.clase],
          ];
          const texto = new estado.Token('text', '', 0);
          texto.content = token.content.slice(inicio, fin);
          const cerrar = new estado.Token('link_close', 'a', -1);
          nuevos.push(antes, abrir, texto, cerrar);
          ultimo = fin;
        }
        if (ultimo === 0) {
          nuevos.push(token);
        } else {
          const resto = new estado.Token('text', '', 0);
          resto.content = token.content.slice(ultimo);
          nuevos.push(resto);
        }
      }
      bloque.children = nuevos;
    }
  });
}

// [♪ 1:39](yt:ID?t=99) o (spotify:track:ID?t=99) → abre Música y suena desde ese segundo.
// Un `yt:`/`spotify:` no válido deja de ser enlace.
md.core.ruler.push('canciones', (estado) => {
  for (const bloque of estado.tokens) {
    for (const token of bloque.children ?? []) {
      if (token.type !== 'link_open') continue;
      const href = String(token.attrGet('href') ?? '');
      if (!href.startsWith('yt:') && !href.startsWith('spotify:')) continue;
      const cancion = leerHrefCancion(href);
      token.attrs = cancion
        ? [
            ['href', rutaCancion(cancion.id, cancion.t)],
            ['class', 'enlace-cancion'],
          ]
        : [];
    }
  }
});

// @AAAA-MM-DD → el día en el Calendario
regla('fechas', FECHA_EN_TEXTO, (m) => {
  const dia = m[2] ?? '';
  return esDiaValido(dia) ? { href: `#/calendario/${dia}`, clase: 'enlace-fecha' } : null;
});

// #etiqueta → la lista de Notas filtrada por esa etiqueta
regla('etiquetas', ETIQUETA_EN_TEXTO, (m) => {
  const etiqueta = (m[2] ?? '').replace(/[-/_]+$/, '');
  if (!etiqueta || etiqueta.length > MAX_ETIQUETA || /^\d+$/.test(etiqueta)) return null;
  return { href: `#/notas?etiqueta=${encodeURIComponent(etiqueta)}`, clase: 'enlace-etiqueta' };
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
