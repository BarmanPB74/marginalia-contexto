import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { extracto, haceCuanto } from '../../src/core/notas/extracto';
import { PantallaNotas } from '../../src/features/notas/PantallaNotas';
import { boton, montar, repoNuevo } from './ayuda';

describe('extracto', () => {
  it('quita las marcas de Markdown y deja el texto', () => {
    expect(extracto('# Título\n\n- [ ] tarea\n- punto\n**negrita** [enlace](https://x.org) `código`')).toBe(
      'Título\n\n☐ tarea\n• punto\nnegrita enlace código',
    );
  });

  it('corta los textos largos con puntos suspensivos', () => {
    expect(extracto('a'.repeat(400), 10)).toBe('aaaaaaaaaa…');
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-10-05T12:00:00Z');
  it('habla como una persona', () => {
    expect(haceCuanto('2026-10-05T11:59:50Z', ahora)).toBe('ahora mismo');
    expect(haceCuanto('2026-10-05T11:55:00Z', ahora)).toBe('hace 5 minutos');
    expect(haceCuanto('2026-10-04T12:00:00Z', ahora)).toBe('ayer');
    expect(haceCuanto('basura', ahora)).toBe('');
  });
});

describe('vista de tarjetas (recientes)', () => {
  it('por defecto en la app: la última editada va primero y se cambia a lista con un toque', async () => {
    let reloj = new Date(2026, 0, 1);
    const repo = repoNuevo(() => reloj);
    const vieja = await repo.crear({ titulo: 'Vieja' });
    await repo.guardar({ ...vieja, cuerpo: 'texto viejo' });
    reloj = new Date(2026, 9, 5);
    const nueva = await repo.crear({ titulo: 'Nueva nota' });
    await repo.guardar({ ...nueva, cuerpo: '# Hola\n\n**mundo**' });
    const c = await montar(<PantallaNotas />, repo);
    const tarjetas = [...c.querySelectorAll('.recientes__tarjeta')];
    expect(tarjetas.map((t) => t.getAttribute('aria-label'))).toEqual(['Nueva nota', 'Vieja']);
    expect(tarjetas[0]?.querySelector('.recientes__vista')?.textContent).toBe('Hola\n\nmundo');
    expect(c.querySelector('.recientes__contador')?.textContent).toBe('1 / 2');

    act(() => boton(c, 'Ver como lista').click());
    expect(c.querySelector('.recientes')).toBeNull();
    expect(c.querySelectorAll('.lista-notas li')).toHaveLength(2);
  });
});
