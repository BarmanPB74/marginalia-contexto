import { describe, expect, it } from 'vitest';
import { leerEnlace, urlIncrustada, urlYoutubeMusic } from '../../src/core/musica/enlaces';

describe('leerEnlace', () => {
  it.each([
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=abc', { video: 'dQw4w9WgXcQ' }],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ', { video: 'dQw4w9WgXcQ', lista: 'RDAMVMdQw4w9WgXcQ' }],
    ['https://music.youtube.com/playlist?list=OLAK5uy_kXyz1234567890abc', { lista: 'OLAK5uy_kXyz1234567890abc' }],
    ['https://youtu.be/dQw4w9WgXcQ?t=90', { video: 'dQw4w9WgXcQ', inicio: 90 }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s', { video: 'dQw4w9WgXcQ', inicio: 90 }],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', { video: 'dQw4w9WgXcQ' }],
    ['Escucha esto en YouTube Music https://music.youtube.com/watch?v=dQw4w9WgXcQ', { video: 'dQw4w9WgXcQ' }],
  ])('%s', (texto, esperado) => expect(leerEnlace(texto)).toEqual(esperado));

  it.each([
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=corto',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
    'no es un enlace',
  ])('rechaza %s', (texto) => expect(leerEnlace(texto)).toBeNull());
});

describe('urlIncrustada', () => {
  it('usa el reproductor oficial sin cookies, con lista e inicio', () => {
    const url = new URL(urlIncrustada({ video: 'dQw4w9WgXcQ', lista: 'RDAMVMdQw4w9WgXcQ', inicio: 90 }, 'https://localhost'));
    expect(url.origin).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/dQw4w9WgXcQ');
    expect(url.searchParams.get('list')).toBe('RDAMVMdQw4w9WgXcQ');
    expect(url.searchParams.get('start')).toBe('90');
    expect(url.searchParams.get('origin')).toBe('https://localhost');
  });

  it('una lista sola usa videoseries', () => {
    expect(urlIncrustada({ lista: 'OLAK5uy_kXyz1234567890abc' }, 'https://localhost')).toContain('/embed/videoseries?');
  });
});

describe('urlYoutubeMusic', () => {
  it('abre la canción o la lista en YouTube Music', () => {
    expect(urlYoutubeMusic({ video: 'dQw4w9WgXcQ' })).toBe('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(urlYoutubeMusic({ lista: 'OLAK5uy_kXyz1234567890abc' })).toBe(
      'https://music.youtube.com/playlist?list=OLAK5uy_kXyz1234567890abc',
    );
  });
});
