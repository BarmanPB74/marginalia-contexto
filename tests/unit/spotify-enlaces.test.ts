import { describe, expect, it } from 'vitest';
import { cancionEnRuta } from '../../src/app/rutas';
import { leerEnlaceSpotify, urlSpotify } from '../../src/core/musica/spotify';

const ID = '4uLU6hMCjMI75M1A2tKUQC';

describe('leerEnlaceSpotify', () => {
  it.each([
    [`https://open.spotify.com/track/${ID}?si=abc123`, { uri: `spotify:track:${ID}`, tipo: 'track' }],
    [`https://open.spotify.com/intl-es/track/${ID}`, { uri: `spotify:track:${ID}`, tipo: 'track' }],
    [`Escucha esto en Spotify: https://open.spotify.com/album/${ID}?si=x`, { uri: `spotify:album:${ID}`, tipo: 'album' }],
    [`spotify:episode:${ID}`, { uri: `spotify:episode:${ID}`, tipo: 'episode' }],
  ])('%s', (texto, esperado) => expect(leerEnlaceSpotify(texto)).toEqual(esperado));

  it.each([
    `https://evil.com/track/${ID}`,
    `https://open.spotify.com.evil.com/track/${ID}`,
    `http://open.spotify.com/track/${ID}`,
    `https://open.spotify.com/artist/${ID}`,
    'https://open.spotify.com/track/corto',
    `spotify:track:${ID}X`,
    'javascript:alert(1)',
  ])('rechaza %s', (texto) => expect(leerEnlaceSpotify(texto)).toBeNull());

  it('abre en Spotify', () => {
    expect(urlSpotify(`spotify:track:${ID}`)).toBe(`https://open.spotify.com/track/${ID}`);
  });
});

describe('ruta de Spotify', () => {
  it('#/musica?sp=track:ID&t=N', () => {
    expect(cancionEnRuta(`#/musica?sp=track%3A${ID}&t=42`)).toEqual({ spotify: `spotify:track:${ID}`, t: 42 });
    expect(cancionEnRuta(`#/musica?sp=album:${ID}`)).toBeNull();
    expect(cancionEnRuta('#/musica?sp=track:malo')).toBeNull();
  });
});
