import { describe, expect, it } from 'vitest';
import { enlaceCompartido, escucharCompartido } from '../../src/features/musica/compartido';

describe('lo compartido desde YouTube Music (entrada no confiable)', () => {
  it('acepta el texto de «Compartir» con su enlace', () => {
    expect(enlaceCompartido('Escucha «Tema» en YouTube Music https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=abc')).toEqual({
      video: 'dQw4w9WgXcQ',
    });
    expect(enlaceCompartido('https://music.youtube.com/playlist?list=OLAK5uy_kXyz1234567890abc')).toEqual({
      lista: 'OLAK5uy_kXyz1234567890abc',
    });
  });

  it('descarta lo que no es texto, lo enorme y lo que no es de YouTube', () => {
    for (const malo of [undefined, 42, {}, 'x'.repeat(2001), 'https://evil.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)']) {
      expect(enlaceCompartido(malo)).toBeNull();
    }
  });

  it('en el navegador no escucha nada (no hay Android)', () => {
    const dejar = escucharCompartido(() => {
      throw new Error('no debería llamarse');
    });
    expect(typeof dejar).toBe('function');
    dejar();
  });
});
