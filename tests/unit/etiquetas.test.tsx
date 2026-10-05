import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { etiquetaEnRuta, rutaActual } from '../../src/app/rutas';
import { renderMarkdown } from '../../src/core/markdown/render';
import { PantallaNotas } from '../../src/features/notas/PantallaNotas';
import { boton, montar, repoNuevo } from './ayuda';

describe('ruta con etiqueta', () => {
  it('#/notas?etiqueta=x filtra Notas; lo demás no', () => {
    expect(rutaActual('#/notas?etiqueta=estudio')).toBe('notas');
    expect(etiquetaEnRuta('#/notas?etiqueta=franc%C3%A9s')).toBe('francés');
    expect(etiquetaEnRuta('#/notas')).toBeNull();
    expect(etiquetaEnRuta('#/calendario?etiqueta=x')).toBeNull();
    expect(etiquetaEnRuta('#/notas?etiqueta=%E0%A4%A')).toBeNull();
  });
});

describe('#etiqueta en modo lectura', () => {
  it('es un enlace a Notas filtradas; no en código, encabezados ni dentro de enlaces', () => {
    const html = renderMarkdown('# Título\n\nHoy #estudio de #francés `#no` [#tampoco](https://x.org) #1');
    expect(html).toContain('<a href="#/notas?etiqueta=estudio" class="enlace-etiqueta">#estudio</a>');
    expect(html).toContain('<a href="#/notas?etiqueta=franc%C3%A9s" class="enlace-etiqueta">#francés</a>');
    expect(html.match(/enlace-etiqueta/g)).toHaveLength(2);
    expect(html).toContain('<h1>Título</h1>');
  });

  it('una etiqueta con caracteres raros no rompe el atributo', () => {
    const html = renderMarkdown('#a"onmouseover=alert(1)');
    expect(html).not.toContain('onmouseover=alert(1)"');
    expect(html).not.toMatch(/<a[^>]*onmouseover/);
  });
});

describe('filtro por etiqueta en Notas', () => {
  async function preparar() {
    const repo = repoNuevo();
    const a = await repo.crear({ titulo: 'Subjuntivo' });
    await repo.guardar({ ...a, cuerpo: 'Repasar #francés y #Estudio' });
    const b = await repo.crear({ titulo: 'Acordes' });
    await repo.guardar({ ...b, etiquetas: ['estudio'], cuerpo: 'séptimas' });
    await repo.crear({ titulo: 'Lista de compras' });
    return repo;
  }

  it('muestra las etiquetas con cuántas notas tienen, las más usadas primero', async () => {
    const c = await montar(<PantallaNotas />, await preparar());
    const chips = [...c.querySelectorAll('.filtro-etiquetas__chip')].map((b) => b.textContent);
    expect(chips).toEqual(['Todas', '#Estudio2', '#francés1']);
  });

  it('con una etiqueta en la ruta solo salen sus notas (sin importar mayúsculas)', async () => {
    const c = await montar(<PantallaNotas etiqueta="estudio" />, await preparar());
    const tarjetas = [...c.querySelectorAll('.recientes__tarjeta')].map((a) => a.getAttribute('aria-label'));
    expect(tarjetas.sort()).toEqual(['Acordes', 'Subjuntivo']);
    expect(c.querySelector('[aria-pressed="true"]')?.textContent).toBe('#Estudio2');
    act(() => boton(c, /^#francés/).click());
    expect(location.hash).toBe('#/notas?etiqueta=franc%C3%A9s');
    act(() => boton(c, 'Todas').click());
    expect(location.hash).toBe('#/notas');
  });

  it('una etiqueta sin notas lo dice', async () => {
    const c = await montar(<PantallaNotas etiqueta="nada" />, await preparar());
    expect(c.querySelector('.estado-vacio')?.textContent).toContain('Ninguna nota con #nada.');
  });
});
