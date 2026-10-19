import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { PantallaMas } from '../../src/features/mas/PantallaMas';
import { seccionesMas } from '../../src/features/mas/secciones';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { puede, type Negocio, type Rol } from '../../src/core/negocio';
import { boton, esperar, montar, negocioDePrueba, repoNuevo } from './ayuda';

async function abrir(n: Negocio) {
  return montar(
    <ProveedorNegocio>
      <PantallaMas />
    </ProveedorNegocio>,
    repoNuevo(),
    n,
  );
}

const titulos = (c: HTMLElement) => [...c.querySelectorAll('.mas__titulo')].map((t) => t.textContent);
const ids = (rol: Rol) => seccionesMas((a) => puede(rol, a)).map((s) => `${s.id}:${s.etiqueta}`);

describe('Más', () => {
  it('el dueño ve todas las secciones y «Cambiar de usuario»', async () => {
    const c = await abrir(await negocioDePrueba());
    expect(titulos(c)).toEqual(['Reservas y clientes', 'Bitácora', 'Caja', 'Compras y facturas', 'Gastos', 'Contabilidad', 'Usuarios', 'Calendario', 'Ajustes', 'Cambiar de usuario']);
    expect(c.querySelector('a[href="#/contabilidad"]')).not.toBeNull();
  });

  it('un cajero creado por el dueño no ve Contabilidad ni Usuarios', async () => {
    const n = await negocioDePrueba();
    const ev = await n.crearUsuario({ nombre: 'Carlos', rol: 'cajero', pin: '5678' });
    expect((await n.iniciarSesion(ev.id, '5678')).ok).toBe(true);
    const c = await abrir(n);
    const t = titulos(c);
    expect(t).not.toContain('Contabilidad');
    expect(t).not.toContain('Usuarios');
    expect(t).toContain('Caja');
    expect(t).toContain('Mi cuenta');
    expect(c.querySelector('a[href="#/contabilidad"]')).toBeNull();
  });

  it('filtra por la tabla de permisos', () => {
    expect(ids('cajero')).toEqual(['reservas:Reservas y clientes', 'notas:Bitácora', 'caja:Caja', 'gastos:Gastos', 'calendario:Calendario', 'usuarios:Mi cuenta', 'ajustes:Ajustes']);
    expect(ids('bodega')).toEqual(['notas:Bitácora', 'compras:Compras y facturas', 'calendario:Calendario', 'usuarios:Mi cuenta', 'ajustes:Ajustes']);
    expect(ids('recepcionista')).toEqual(['reservas:Reservas y clientes', 'notas:Bitácora', 'calendario:Calendario', 'usuarios:Mi cuenta', 'ajustes:Ajustes']);
  });

  it('«Cambiar de usuario» cierra la sesión', async () => {
    const n = await negocioDePrueba();
    const c = await abrir(n);
    await act(() => boton(c, /Cambiar de usuario/).click());
    await esperar();
    expect(n.sesion).toBeNull();
  });
});
