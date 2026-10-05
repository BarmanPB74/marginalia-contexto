import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { boton, esperar, montar, repoNuevo } from './ayuda';

function escribir(entrada: HTMLInputElement, texto: string) {
  entrada.value = texto;
  entrada.dispatchEvent(new Event('input', { bubbles: true }));
}

function tecla(entrada: HTMLElement, key: string) {
  entrada.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

async function abrirPaleta(c: HTMLElement) {
  act(() => boton(c, 'Buscar y comandos').click());
  await esperar();
  const entrada = c.querySelector<HTMLInputElement>('.paleta__entrada');
  if (!entrada) throw new Error('No se abrió la paleta');
  return entrada;
}

const opciones = (c: HTMLElement) => [...c.querySelectorAll('[role="option"]')].map((o) => o.querySelector('.paleta__nombre')?.textContent);

describe('paleta de comandos', () => {
  it('encuentra un ajuste por nombre, sin tildes, y lo aplica con Intro', async () => {
    location.hash = '#/notas';
    const c = await montar(<App />, repoNuevo());
    const entrada = await abrirPaleta(c);
    act(() => escribir(entrada, 'tema osc'));
    expect(opciones(c)[0]).toBe('Tema: oscuro');
    act(() => tecla(entrada, 'Enter'));
    expect(document.documentElement.dataset['tema']).toBe('oscuro');
    expect(c.querySelector('.paleta')).toBeNull();
  });

  it('busca notas por título y por texto, y abre la elegida', async () => {
    const repo = repoNuevo();
    const n = await repo.crear({ titulo: 'Apuntes de armonía' });
    await repo.guardar({ ...n, cuerpo: 'El acorde de séptima suena estable.' });
    location.hash = '#/notas';
    const c = await montar(<App />, repo);
    const entrada = await abrirPaleta(c);
    act(() => escribir(entrada, 'septima'));
    expect(opciones(c)).toContain('Apuntes de armonía');
    expect(c.querySelector('.paleta__detalle')?.textContent).toContain('séptima');
    const opcion = [...c.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes('Apuntes'));
    act(() => opcion?.click());
    expect(location.hash).toBe(`#/notas/${n.id}`);
  });

  it('herramientas: «bitácora» crea la de hoy; las flechas mueven la selección; Escape cierra', async () => {
    const repo = repoNuevo();
    location.hash = '#/notas';
    const c = await montar(<App />, repo);
    let entrada = await abrirPaleta(c);
    act(() => escribir(entrada, 'ir a'));
    act(() => tecla(entrada, 'ArrowDown'));
    expect(c.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(c.querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('false');
    act(() => tecla(entrada, 'Escape'));
    expect(c.querySelector('.paleta')).toBeNull();

    entrada = await abrirPaleta(c);
    act(() => escribir(entrada, 'bitacora de hoy'));
    await act(async () => tecla(entrada, 'Enter'));
    await esperar();
    const { notas } = await repo.listar();
    expect(notas).toHaveLength(1);
    expect(notas[0]?.titulo).toMatch(/^Bitácora \d{4}-\d\d-\d\d$/);
  });

  it('Ctrl+K la abre desde cualquier pantalla', async () => {
    location.hash = '#/calendario';
    const c = await montar(<App />, repoNuevo());
    act(() => {
      dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    await esperar();
    expect(c.querySelector('.paleta')).not.toBeNull();
  });
});
