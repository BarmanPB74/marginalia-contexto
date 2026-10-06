import { describe, expect, it } from 'vitest';
import { cancionEnRuta, rutaActual } from '../../src/app/rutas';
import { renderMarkdown } from '../../src/core/markdown/render';
import {
  cancionDeNota,
  conCancionPrincipal,
  enlaceCancion,
  leerHrefCancion,
  minutoSegundo,
} from '../../src/core/musica/etiqueta';
import { escribirNota, leerNota, type Nota } from '../../src/core/notas/nota';

const base: Nota = {
  id: '01J9ZK3Q8V2M4N6P7R8S9T0WXY',
  titulo: 'Subjuntivo',
  creado: '2026-10-05T09:00:00-05:00',
  editado: '2026-10-05T09:00:00-05:00',
  etiquetas: [],
  extra: { otro: 1 },
  cuerpo: '',
};

describe('canción principal (frontmatter)', () => {
  it('se escribe y se vuelve a leer igual, sin tocar los demás campos', () => {
    const n = conCancionPrincipal(base, { yt: 'dQw4w9WgXcQ', titulo: 'Tema', artista: 'Alguien', t: 139.7 });
    const leida = leerNota(escribirNota(n));
    expect(cancionDeNota(leida)).toEqual({ yt: 'dQw4w9WgXcQ', titulo: 'Tema', artista: 'Alguien', t: 139 });
    expect(leida.extra['otro']).toBe(1);
    expect(escribirNota(n)).toContain('cancion:\n  yt: dQw4w9WgXcQ');
  });

  it('ignora canciones mal escritas', () => {
    for (const cancion of [null, 'texto', ['x'], { yt: 'corto' }, { yt: '<script>xx>' }]) {
      expect(cancionDeNota({ extra: { cancion } })).toBeNull();
    }
    expect(cancionDeNota({ extra: { cancion: { yt: 'dQw4w9WgXcQ', t: -3 } } })).toEqual({ yt: 'dQw4w9WgXcQ' });
  });
});

describe('enlace en línea', () => {
  it('minuto:segundo y enlace yt:', () => {
    expect(minutoSegundo(99)).toBe('1:39');
    expect(minutoSegundo(3725)).toBe('1:02:05');
    expect(enlaceCancion('dQw4w9WgXcQ', 99.9)).toBe('[♪ 1:39](yt:dQw4w9WgXcQ?t=99)');
    expect(() => enlaceCancion('mal')).toThrow();
  });

  it('leerHrefCancion solo acepta IDs válidos', () => {
    expect(leerHrefCancion('yt:dQw4w9WgXcQ?t=99')).toEqual({ yt: 'dQw4w9WgXcQ', t: 99 });
    expect(leerHrefCancion('yt:dQw4w9WgXcQ')).toEqual({ yt: 'dQw4w9WgXcQ', t: 0 });
    expect(leerHrefCancion('yt:dQw4w9WgXcQ?t=99&x=1')).toBeNull();
    expect(leerHrefCancion('yt:javascript:alert(1)')).toBeNull();
  });

  it('en lectura, ♪ lleva a Música en ese segundo; un yt: inválido deja de ser enlace', () => {
    const html = renderMarkdown('Sonaba [♪ 1:39](yt:dQw4w9WgXcQ?t=99) y [♪ x](yt:malo)');
    expect(html).toContain('<a href="#/musica?yt=dQw4w9WgXcQ&amp;t=99" class="enlace-cancion">♪ 1:39</a>');
    expect(html).toContain('<a>♪ x</a>');
  });
});

describe('ruta de canción', () => {
  it('#/musica?yt=ID&t=N', () => {
    expect(rutaActual('#/musica?yt=dQw4w9WgXcQ&t=99')).toBe('musica');
    expect(cancionEnRuta('#/musica?yt=dQw4w9WgXcQ&t=99')).toEqual({ yt: 'dQw4w9WgXcQ', t: 99 });
    expect(cancionEnRuta('#/musica?yt=dQw4w9WgXcQ&t=-1')).toEqual({ yt: 'dQw4w9WgXcQ', t: 0 });
    expect(cancionEnRuta('#/musica?yt=malo')).toBeNull();
    expect(cancionEnRuta('#/notas?yt=dQw4w9WgXcQ')).toBeNull();
  });
});
