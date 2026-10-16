import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { Negocio } from '../../src/core/negocio';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { montar, repoNuevo } from './ayuda';

async function abrir(hash: string, negocio?: Negocio) {
  location.hash = hash;
  return montar(<App />, repoNuevo(), negocio);
}

describe('App', () => {
  it('la Bitácora (notas) tiene la navegación de secciones', async () => {
    const c = await abrir('#/notas');
    expect(c.querySelector('h1')?.textContent).toBe('Notas');
    expect(c.querySelector('nav[aria-label="Secciones"]')).not.toBeNull();
  });

  it('cada hash abre su sección', async () => {
    const c = await abrir('#/calendario');
    expect(c.querySelector('h1')?.textContent).toBe('Calendario');
  });

  it('primer uso: sin dueño no se ve nada del negocio, se pide crearlo', async () => {
    const vacio = await Negocio.crear(crearAlmacen(new DiscoMemoria()), { iteracionesPin: 1000 });
    const c = await abrir('#/notas', vacio);
    expect(c.querySelector('h1')?.textContent).toBe('Bienvenido');
    expect(c.querySelector('nav[aria-label="Secciones"]')).toBeNull();
  });

  it('sin sesión se pide la persona y su PIN', async () => {
    const n = await Negocio.crear(crearAlmacen(new DiscoMemoria()), { iteracionesPin: 1000 });
    await n.crearUsuario({ nombre: 'Ana', rol: 'dueno', pin: '1234' });
    n.cerrarSesion();
    const c = await abrir('#/notas', n);
    expect(c.querySelector('h1')?.textContent).toBe('Ana');
    expect(c.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Escribe tu PIN');
    expect(c.querySelector('nav[aria-label="Secciones"]')).toBeNull();
  });
});
