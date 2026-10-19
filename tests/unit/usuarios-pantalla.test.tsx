import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { PantallaUsuarios, quePuede } from '../../src/features/usuarios/PantallaUsuarios';
import type { Negocio } from '../../src/core/negocio';
import { boton, esperar, hastaQue, montar, negocioDePrueba, repoNuevo } from './ayuda';

async function abrir(n: Negocio) {
  return montar(
    <ProveedorNegocio>
      <PantallaUsuarios />
    </ProveedorNegocio>,
    repoNuevo(),
    n,
  );
}

async function tocar(c: HTMLElement, texto: string | RegExp) {
  await act(() => boton(c, texto).click());
  await esperar();
}

/** Teclea un PIN en el TecladoPin que esté montado. */
async function teclear(c: HTMLElement, pin: string) {
  for (const d of pin) await act(() => boton(c, d).click());
  await esperar();
}

function campo(c: HTMLElement): HTMLInputElement {
  const e = c.querySelector<HTMLInputElement>('.hoja input');
  if (!e) throw new Error('No hay campo en la hoja');
  return e;
}

function dialogo(c: HTMLElement): HTMLElement {
  const d = c.querySelector<HTMLElement>('.dialogo');
  if (!d) throw new Error('No hay diálogo');
  return d;
}

async function escribir(entrada: HTMLInputElement, texto: string) {
  await act(() => {
    entrada.value = texto;
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Usuarios', () => {
  it('el dueño crea un cajero con nombre, cargo y PIN dos veces', async () => {
    const n = await negocioDePrueba();
    const c = await abrir(n);
    await tocar(c, 'Nueva persona');
    await escribir(campo(c), 'Carlos');
    // El cargo explica lo que puede, desde la tabla de permisos
    expect(c.querySelector('.usuarios__permisos')?.textContent).toContain('vender');
    await tocar(c, 'Bodega');
    expect(c.querySelector('.usuarios__permisos')?.textContent).toContain('contar el inventario');
    await tocar(c, 'Cajero');
    await tocar(c, 'Seguir: crear su PIN');
    await teclear(c, '5678');
    await teclear(c, '5678');
    const carlos = n.usuarios().find((x) => x.nombre === 'Carlos');
    expect(carlos?.rol).toBe('cajero');
    expect(c.textContent).toContain('«Carlos» ya puede entrar con su PIN');
    expect((await n.iniciarSesion(carlos?.id ?? '', '5678')).ok).toBe(true);
  });

  it('si el PIN repetido no coincide, lo pide otra vez y no crea nada', async () => {
    const n = await negocioDePrueba();
    const c = await abrir(n);
    await tocar(c, 'Nueva persona');
    await escribir(campo(c), 'Bea');
    await tocar(c, 'Seguir: crear su PIN');
    await teclear(c, '1111');
    await teclear(c, '2222');
    expect(c.textContent).toContain('No coinciden');
    expect(n.usuarios()).toHaveLength(1);
  });

  it('cambiar mi PIN pide el actual', async () => {
    const n = await negocioDePrueba();
    const c = await abrir(n);
    const yo = n.sesion?.id ?? '';
    await tocar(c, 'Cambiar mi PIN');
    await teclear(c, '9999');
    await teclear(c, '4321');
    await teclear(c, '4321');
    await hastaQue(() => (c.textContent ?? '').includes('El PIN actual no es correcto.'));
    expect(c.textContent).toContain('El PIN actual no es correcto.');
    await teclear(c, '1234');
    await teclear(c, '4321');
    await teclear(c, '4321');
    await hastaQue(() => (c.textContent ?? '').includes('Tu PIN cambió.'));
    expect(c.textContent).toContain('Tu PIN cambió.');
    expect((await n.iniciarSesion(yo, '4321')).ok).toBe(true);
  });

  it('no deja desactivar al último dueño: lo dice el núcleo', async () => {
    const n = await negocioDePrueba();
    const c = await abrir(n);
    await tocar(c, 'Desactivar a Dueña');
    await tocar(dialogo(c), 'Desactivar');
    expect(n.sesion).not.toBeNull();
    expect(c.querySelector('.usuarios__aviso')?.textContent).toMatch(/dueño/i);
  });

  it('un cajero solo ve «Mi cuenta»', async () => {
    const n = await negocioDePrueba();
    const ev = await n.crearUsuario({ nombre: 'Carlos', rol: 'cajero', pin: '5678' });
    await n.iniciarSesion(ev.id, '5678');
    const c = await abrir(n);
    expect(c.querySelector('h1')?.textContent).toBe('Mi cuenta');
    expect(c.textContent).not.toContain('Personas');
    expect(() => boton(c, 'Nueva persona')).toThrow();
  });

  it('cerrar sesión vuelve a la entrada con PIN', async () => {
    const n = await negocioDePrueba();
    location.hash = '#/usuarios';
    const c = await montar(<App />, repoNuevo(), n);
    expect(c.querySelector('h1')?.textContent).toBe('Usuarios');
    await tocar(c, 'Cerrar sesión / Cambiar de usuario');
    expect(n.sesion).toBeNull();
    expect(location.hash).toBe('#/inicio');
    expect(c.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Escribe tu PIN');
  });

  it('describe cada cargo con la tabla de permisos', () => {
    expect(quePuede('dueno')).toMatch(/^Puede hacer todo/);
    expect(quePuede('cajero')).toContain('abrir la caja');
    expect(quePuede('cajero')).not.toContain('ver la contabilidad');
  });
});
