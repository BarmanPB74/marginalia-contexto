import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { boton, esperar, montar, repoNuevo } from './ayuda';

const GUARDADA = [{ clave: 'dQw4w9WgXcQ', enlace: { video: 'dQw4w9WgXcQ' }, titulo: 'Tema guardado', artista: 'Alguien' }];

async function irA(hash: string) {
  await act(async () => {
    location.hash = hash;
    dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await esperar();
}

async function musicaSonando() {
  localStorage.setItem('marginalia.canciones.v1', JSON.stringify(GUARDADA));
  location.hash = '#/musica';
  const c = await montar(<App />, repoNuevo());
  // Elegir la canción la pone a sonar (como tocarla en la lista)
  act(() => (c.querySelector('.musica__elegir') as HTMLButtonElement).click());
  await esperar();
  return c;
}

describe('opción B: ventana flotante con el video', () => {
  it('al salir de Música sonando, el MISMO iframe sigue como ventana flotante (no se recarga)', async () => {
    const c = await musicaSonando();
    const marco = c.querySelector('iframe');
    expect(c.querySelector('.capa-video--musica')).not.toBeNull();
    await irA('#/notas');
    expect(c.querySelector('.capa-video--flotante')).not.toBeNull();
    expect(c.querySelector('iframe')).toBe(marco);
    // con el video flotando, el globo dibujado sobra
    expect(c.querySelector('.mini')).toBeNull();
    await irA('#/musica');
    expect(c.querySelector('.capa-video--musica')).not.toBeNull();
    expect(c.querySelector('iframe')).toBe(marco);
  });

  it('esconderla a un lado la pausa y deja una pestaña; la pestaña la trae de vuelta', async () => {
    const c = await musicaSonando();
    const marco = c.querySelector('iframe') as HTMLIFrameElement;
    const enviar = vi.spyOn(marco.contentWindow as Window, 'postMessage');
    await irA('#/notas');
    act(() => boton(c, 'Esconder reproductor a un lado (se pausa)').click());
    expect(enviar).toHaveBeenCalledWith(expect.stringContaining('"func":"pauseVideo"'), 'https://www.youtube-nocookie.com');
    expect(c.querySelector('.capa-video--escondida')).not.toBeNull();
    const pestana = c.querySelector('.mini-pestana') as HTMLButtonElement;
    act(() => pestana.click());
    expect(c.querySelector('.capa-video--escondida')).toBeNull();
  });

  it('cerrarla para la música y quita el reproductor; salir de Música en pausa no la abre', async () => {
    const c = await musicaSonando();
    await irA('#/notas');
    act(() => boton(c, 'Cerrar reproductor').click());
    expect(c.querySelector('iframe')).toBeNull();
    expect(c.querySelector('.mini')).not.toBeNull();

    await irA('#/musica');
    expect(c.querySelector('iframe')).not.toBeNull(); // en Música sí está (en pausa)
    await irA('#/calendario');
    expect(c.querySelector('iframe')).toBeNull();
  });
});
