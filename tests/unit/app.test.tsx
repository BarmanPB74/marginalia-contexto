import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';

let contenedor: HTMLElement;

function montar(hash = '') {
  location.hash = hash;
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  act(() => render(<App />, contenedor));
}

afterEach(() => {
  render(null, contenedor);
  contenedor.remove();
  location.hash = '';
});

describe('App', () => {
  it('abre Notas por defecto, con la barra de secciones', () => {
    montar();
    expect(contenedor.querySelector('h1')?.textContent).toBe('Notas');
    expect(contenedor.querySelector('nav[aria-label="Secciones"]')).not.toBeNull();
  });

  it('cada hash abre su sección', () => {
    montar('#/calendario');
    expect(contenedor.querySelector('h1')?.textContent).toBe('Calendario');
  });

  it('la galería se muestra sin barra de secciones', () => {
    montar('#/galeria');
    expect(contenedor.querySelector('h1')?.textContent).toBe('Galería');
    expect(contenedor.querySelector('nav')).toBeNull();
  });

  it('Música no carga ningún iframe hasta que se elige una canción', () => {
    montar('#/musica');
    expect(contenedor.querySelector('h1')?.textContent).toBe('Música');
    expect(contenedor.querySelector('iframe')).toBeNull();
  });
});
