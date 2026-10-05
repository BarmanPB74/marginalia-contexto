import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { cancionDeNota } from '../../src/core/musica/etiqueta';
import { boton, esperar, montar, repoNuevo } from './ayuda';

const GUARDADA = [{ clave: 'dQw4w9WgXcQ', enlace: { video: 'dQw4w9WgXcQ' }, titulo: 'Tema guardado', artista: 'Alguien' }];

describe('historia 4: nota con la canción que suena', () => {
  it('crear({ cancion }) la guarda en el frontmatter y como ♪ en la primera línea', async () => {
    const repo = repoNuevo();
    const n = await repo.crear({ plantilla: 'rapida', cancion: { yt: 'dQw4w9WgXcQ', titulo: 'Tema', t: 99 } });
    expect(cancionDeNota(n)).toEqual({ yt: 'dQw4w9WgXcQ', titulo: 'Tema', t: 99 });
    expect(n.cuerpo.startsWith('[♪ 1:39](yt:dQw4w9WgXcQ?t=99)')).toBe(true);
  });

  it('«Nueva nota con esta canción» en Música crea la nota y la abre', async () => {
    localStorage.setItem('marginalia.canciones.v1', JSON.stringify(GUARDADA));
    const repo = repoNuevo();
    location.hash = '#/musica';
    const c = await montar(<App />, repo);
    await act(async () => boton(c, '♪ Nueva nota con esta canción').click());
    await esperar();
    const id = location.hash.replace('#/notas/', '');
    const nota = await repo.obtener(id);
    expect(cancionDeNota(nota ?? { extra: {} })).toEqual({ yt: 'dQw4w9WgXcQ', titulo: 'Tema guardado', artista: 'Alguien', t: 0 });
  });
});

describe('historia 5: tocar ♪ reproduce desde ese segundo', () => {
  it('#/musica?yt=ID&t=99 carga el reproductor oficial en el segundo 99 y limpia la ruta', async () => {
    localStorage.setItem('marginalia.canciones.v1', JSON.stringify(GUARDADA));
    location.hash = '#/musica?yt=dQw4w9WgXcQ&t=99';
    const c = await montar(<App />, repoNuevo());
    const src = new URL(c.querySelector('iframe')?.getAttribute('src') ?? '');
    expect(src.pathname).toBe('/embed/dQw4w9WgXcQ');
    expect(src.searchParams.get('start')).toBe('99');
    expect(location.hash).toBe('#/musica');
    // la guardada no se queda con el segundo
    expect(localStorage.getItem('marginalia.canciones.v1')).not.toContain('inicio');
  });

  it('la nota muestra su canción como píldora que lleva a ese segundo', async () => {
    const repo = repoNuevo();
    const n = await repo.crear({ titulo: 'Con música', cancion: { yt: 'dQw4w9WgXcQ', titulo: 'Tema', t: 99 } });
    await repo.guardar({ ...n });
    location.hash = `#/notas/${n.id}`;
    const c = await montar(<App />, repo);
    const pildora = c.querySelector('a.nota__cancion');
    expect(pildora?.getAttribute('href')).toBe('#/musica?yt=dQw4w9WgXcQ&t=99');
    expect(pildora?.textContent).toContain('1:39');
    expect(c.querySelector('.lectura a.enlace-cancion')?.getAttribute('href')).toBe('#/musica?yt=dQw4w9WgXcQ&t=99');
  });
});

describe('errores del reproductor', () => {
  it('un video que no se deja incrustar avisa y ofrece YouTube Music; mensajes de otro origen se ignoran', async () => {
    localStorage.setItem('marginalia.canciones.v1', JSON.stringify(GUARDADA));
    location.hash = '#/musica';
    const c = await montar(<App />, repoNuevo());
    const marco = c.querySelector('iframe') as HTMLIFrameElement;
    const enviar = (origin: string) =>
      act(() => {
        dispatchEvent(
          new MessageEvent('message', {
            data: JSON.stringify({ event: 'onError', info: 150 }),
            origin,
            source: marco.contentWindow,
          }),
        );
      });
    enviar('https://evil.example');
    expect(c.querySelector('[role="alert"]')).toBeNull();
    enviar('https://www.youtube-nocookie.com');
    expect(c.querySelector('[role="alert"]')?.textContent).toContain('no deja reproducirla fuera de YouTube');
    expect(c.querySelector('a[href^="https://music.youtube.com/watch?v=dQw4w9WgXcQ"]')).not.toBeNull();
  });
});
