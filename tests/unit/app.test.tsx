import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { urlEmbed } from '../../src/spike/SpikeReproductor';

let contenedor: HTMLElement;

function montar() {
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  act(() => render(<App />, contenedor));
}

afterEach(() => {
  render(null, contenedor);
  contenedor.remove();
});

describe('App', () => {
  it('muestra el nombre en la pantalla de papel', () => {
    montar();
    expect(contenedor.querySelector('h1')?.textContent).toBe('Marginalia');
  });

  it('no carga ningún iframe hasta que se pide la prueba', () => {
    montar();
    expect(contenedor.querySelector('iframe')).toBeNull();
  });

  it('el spike solo apunta a dominios oficiales de YouTube por https', () => {
    expect(urlEmbed('nocookie')).toBe('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE');
    expect(urlEmbed('youtube')).toBe('https://www.youtube.com/embed/M7lc1UVf-VE');
  });
});
