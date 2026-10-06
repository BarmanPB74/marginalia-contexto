import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/core/markdown/render';

/** Construye el HTML como DOM sin ejecutar nada (DOMParser no corre scripts). */
function pintar(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, 'text/html').body;
}

/** Devuelve todo lo peligroso que haya quedado en el HTML. */
function peligros(html: string): string[] {
  const caja = pintar(html);
  const hallados: string[] = [];
  for (const el of caja.querySelectorAll('*')) {
    const etiqueta = el.tagName.toLowerCase();
    if (['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form', 'svg', 'math', 'base'].includes(etiqueta)) {
      hallados.push(`<${etiqueta}>`);
    }
    for (const attr of el.attributes) {
      const valor = attr.value.replace(/[\s\p{Cc}]/gu, '').toLowerCase();
      if (attr.name.startsWith('on')) hallados.push(`${etiqueta}[${attr.name}]`);
      if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(attr.name)) {
        if (/^(javascript|vbscript|data:text|data:application|data:image\/svg)/.test(valor) || valor.startsWith('data:text')) {
          hallados.push(`${etiqueta}[${attr.name}=${attr.value}]`);
        }
      }
      if (attr.name === 'style') hallados.push(`${etiqueta}[style]`);
    }
  }
  return hallados;
}

describe('renderMarkdown', () => {
  it('pinta CommonMark + GFM: encabezados, énfasis, listas, tablas, tachado, código', () => {
    const html = renderMarkdown(
      '# Título\n\nTexto con **negrita**, *cursiva* y ~~tachado~~.\n\n- uno\n- dos\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`código`\n',
    );
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<strong>negrita</strong>');
    expect(html).toContain('<em>cursiva</em>');
    expect(html).toContain('<s>tachado</s>');
    expect(html).toContain('<li>uno</li>');
    expect(html).toContain('<table>');
    expect(html).toContain('<code>código</code>');
  });

  it('las tareas "- [ ]" y "- [x]" salen como casillas de solo lectura', () => {
    const caja = pintar(renderMarkdown('- [ ] Repasar\n- [x] Ver video\n- [ ]sin espacio no es tarea'));
    const casillas = [...caja.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(casillas.map((c) => c.checked)).toEqual([false, true]);
    expect(casillas.every((c) => c.disabled)).toBe(true);
    expect(caja.querySelector('li')?.textContent?.trim()).toBe('Repasar');
    expect(caja.textContent).toContain('[ ]sin espacio');
  });

  it('los enlaces externos abren fuera de la app y sin dar acceso a ella', () => {
    const caja = pintar(renderMarkdown('[web](https://example.org)'));
    const a = caja.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.org');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('una nota vacía no pinta nada', () => {
    expect(renderMarkdown('')).toBe('');
  });

  describe('XSS (docs/SEGURIDAD.md, puerta de F2)', () => {
    const ataques: [string, string][] = [
      ['<script> en línea', 'hola <script>alert(1)</script>'],
      ['<script> en bloque', '<script>\nalert(1)\n</script>'],
      ['img con onerror', '<img src=x onerror="alert(1)">'],
      ['svg con onload', '<svg onload=alert(1)>'],
      ['iframe', '<iframe src="javascript:alert(1)"></iframe>'],
      ['estilo', '<style>body{display:none}</style>'],
      ['enlace javascript:', '[clic](javascript:alert(1))'],
      ['enlace JaVaScRiPt: con mayúsculas', '[clic](JaVaScRiPt:alert(1))'],
      ['enlace javascript: con entidades', '[clic](&#106;avascript:alert(1))'],
      ['enlace javascript: con tabulador', '[clic](java\tscript:alert(1))'],
      ['enlace vbscript:', '[clic](vbscript:msgbox(1))'],
      ['enlace data:text/html', '[clic](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
      ['imagen data:svg', '![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)'],
      ['autoenlace javascript:', '<javascript:alert(1)>'],
      ['título que intenta salir del atributo', '[a](https://x.org "\\" onmouseover=\\"alert(1)")'],
      ['referencia con javascript:', '[a][r]\n\n[r]: javascript:alert(1)'],
      ['HTML partido en líneas', '<img\nsrc=x\nonerror=alert(1)>'],
      ['comentario HTML', '<!-- <img src=x onerror=alert(1)> -->'],
      ['tabla con HTML', '| <img src=x onerror=alert(1)> |\n|---|\n| x |'],
      ['casilla con HTML', '- [ ] <img src=x onerror=alert(1)>'],
      ['formulario', '<form action="https://evil.example"><button>ok</button></form>'],
      ['base que secuestra rutas', '<base href="https://evil.example/">'],
    ];

    it.each(ataques)('%s: no deja nada ejecutable', (_caso, texto) => {
      expect(peligros(renderMarkdown(texto))).toEqual([]);
    });

    it('el HTML escrito en la nota se muestra como texto, no se interpreta', () => {
      const caja = pintar(renderMarkdown('<b>hola</b>'));
      expect(caja.querySelector('b')).toBeNull();
      expect(caja.textContent).toContain('<b>hola</b>');
    });

    // En jsdom DOMPurify es ~10× más lento que en la WebView (DOM nativo): esto mide que termina, no la velocidad real.
    it('una nota de 2 MB se pinta sin colgarse', () => {
      const parrafo = 'Lorem **ipsum** dolor [enlace](https://example.org) `código` sit amet.\n\n';
      const texto = parrafo.repeat(Math.floor((2 * 1024 * 1024) / parrafo.length));
      const inicio = performance.now();
      const html = renderMarkdown(texto);
      expect(performance.now() - inicio).toBeLessThan(30_000);
      expect(peligros(html.slice(0, 5000))).toEqual([]);
    }, 40_000);

    it('anidar sin fin (citas o listas) no revienta la pila', () => {
      expect(() => renderMarkdown('>'.repeat(50_000) + ' x')).not.toThrow();
      expect(() => renderMarkdown('- '.repeat(20_000) + 'x')).not.toThrow();
      expect(() => renderMarkdown('['.repeat(50_000))).not.toThrow();
    });
  });
});

describe('@fecha en modo lectura', () => {
  it('se vuelve un enlace al día del calendario', () => {
    const html = renderMarkdown('Entrega @2026-10-12 18:30, repaso (@2026-10-10).');
    expect(html).toContain('<a href="#/calendario/2026-10-12" class="enlace-fecha">@2026-10-12 18:30</a>');
    expect(html).toContain('(<a href="#/calendario/2026-10-10" class="enlace-fecha">@2026-10-10</a>).');
  });

  it('no toca fechas imposibles, código ni texto que ya es enlace', () => {
    const html = renderMarkdown('@2026-02-30 `@2026-10-01` [@2026-10-02](https://ejemplo.org)\n\n    @2026-10-03');
    expect(html).not.toContain('enlace-fecha');
  });
});
