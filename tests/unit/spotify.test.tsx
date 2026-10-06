import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { leerAjustes } from '../../src/app/ajustes';
import { cancionEnRuta } from '../../src/app/rutas';
import { spotifyCompartido } from '../../src/features/musica/compartido';
import { estadoSeguro, mensajeSpotify, segundoAhora } from '../../src/features/musica/spotifyRemoto';
import { montar, repoNuevo } from './ayuda';

const PISTA = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';

describe('Spotify (ADR-013): lo que llega del plugin se valida', () => {
  it('estadoSeguro limpia y rechaza lo que no tiene forma', () => {
    expect(
      estadoSeguro({ pausado: false, posicionMs: 42_500, uri: PISTA, titulo: ' Tema ', artista: 'Alguien', duracionMs: 200_000 }),
    ).toEqual({ pausado: false, posicionMs: 42_500, uri: PISTA, titulo: 'Tema', artista: 'Alguien', duracionMs: 200_000 });
    expect(estadoSeguro({ pausado: true, posicionMs: -5, uri: 'javascript:alert(1)' })).toEqual({ pausado: true, posicionMs: 0 });
    for (const malo of [null, 'texto', [], { posicionMs: 1 }, { pausado: 'no' }]) expect(estadoSeguro(malo)).toBeNull();
  });

  it('segundoAhora suma el tiempo pasado solo si suena, sin pasar de la duración', () => {
    const sonando = { pausado: false, posicionMs: 10_000, duracionMs: 12_000 };
    expect(segundoAhora(sonando, 1000, 2500)).toBe(11);
    expect(segundoAhora(sonando, 1000, 60_000)).toBe(12);
    expect(segundoAhora({ ...sonando, pausado: true }, 1000, 60_000)).toBe(10);
    expect(segundoAhora(null, 0, 0)).toBe(0);
  });

  it('cada error del plugin tiene un mensaje claro', () => {
    expect(mensajeSpotify({ code: 'SIN_APP' })).toContain('Instala la app de Spotify');
    expect(mensajeSpotify({ code: 'NO_AUTORIZADO' })).toContain('Client ID');
    expect(mensajeSpotify(new Error('x'))).toContain('No se pudo hablar con Spotify');
  });
});

describe('Spotify: ajustes, rutas y compartir', () => {
  it('la fuente y el Client ID se guardan solo si son válidos', () => {
    expect(leerAjustes()).toMatchObject({ fuente: 'youtube', spotifyClientId: '' });
    localStorage.setItem('marginalia.ajustes.v1', JSON.stringify({ fuente: 'spotify', spotifyClientId: 'a'.repeat(32) }));
    expect(leerAjustes()).toMatchObject({ fuente: 'spotify', spotifyClientId: 'a'.repeat(32) });
    localStorage.setItem('marginalia.ajustes.v1', JSON.stringify({ fuente: 'otra', spotifyClientId: '<script>' }));
    expect(leerAjustes()).toMatchObject({ fuente: 'youtube', spotifyClientId: '' });
  });

  it('#/musica?sp=track:ID&t=N pide esa pista; tipos que no se marcan por segundo, no', () => {
    expect(cancionEnRuta('#/musica?sp=track%3A4uLU6hMCjMI75M1A2tKUQC&t=42')).toEqual({ spotify: PISTA, t: 42 });
    expect(cancionEnRuta('#/musica?sp=playlist%3A4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(cancionEnRuta('#/musica?sp=track%3Acorto')).toBeNull();
  });

  it('compartir desde Spotify da la URI; lo demás se descarta', () => {
    expect(spotifyCompartido('Escucha esto https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=abc')).toEqual({
      uri: PISTA,
      tipo: 'track',
    });
    expect(spotifyCompartido('https://open.spotify.com.malo.com/track/4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(spotifyCompartido(42)).toBeNull();
    expect(spotifyCompartido('x'.repeat(3000))).toBeNull();
  });
});

describe('Spotify en Música (navegador)', () => {
  it('el selector de fuente cambia a Spotify, lo recuerda y explica que suena en su app', async () => {
    location.hash = '#/musica';
    const c = await montar(<App />, repoNuevo());
    const opcion = [...c.querySelectorAll<HTMLButtonElement>('[role=radio]')].find((b) => b.textContent === 'Spotify');
    await act(async () => opcion?.click());
    expect(opcion?.getAttribute('aria-checked')).toBe('true');
    expect(c.textContent).toContain('Spotify suena en su propia app.');
    expect(leerAjustes().fuente).toBe('spotify');
    // Sin video de YouTube con Spotify elegido
    expect(c.querySelector('iframe')).toBeNull();
  });

  it('Ajustes guarda el Client ID solo cuando es válido', async () => {
    location.hash = '#/ajustes';
    const c = await montar(<App />, repoNuevo());
    const campo = [...c.querySelectorAll<HTMLInputElement>('input')].find((i) => i.placeholder === '32 letras y números');
    const escribir = async (v: string) =>
      act(async () => {
        if (!campo) return;
        campo.value = v;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      });
    await escribir('no-vale');
    expect(c.textContent).toContain('no es válido');
    expect(leerAjustes().spotifyClientId).toBe('');
    await escribir('0123456789ABCDEF0123456789abcdef');
    expect(leerAjustes().spotifyClientId).toBe('0123456789abcdef0123456789abcdef');
  });
});
