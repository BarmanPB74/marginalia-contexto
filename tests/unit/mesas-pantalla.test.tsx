import { describe, expect, it } from 'vitest';
import { act } from 'preact/test-utils';
import { centavos, cuentaDeMesa, milesimas, stockDe, type Negocio } from '../../src/core/negocio';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { PantallaMesas } from '../../src/features/mesas/PantallaMesas';
import { boton, esperar, hastaQue, montar, negocioDePrueba, repoNuevo } from './ayuda';

const $ = (p: number) => centavos(p * 100);

async function preparar({ caja = true } = {}) {
  const negocio = await negocioDePrueba();
  const cerveza = (await negocio.crearProducto({ nombre: 'Cerveza', categoria: 'Bebidas', unidad: 'unidad', precio: $(8500) })).id;
  const cafe = (await negocio.crearProducto({ nombre: 'Café', categoria: 'Calientes', unidad: 'unidad', precio: $(4000) })).id;
  await negocio.ajustarInventario({ productoId: cerveza, delta: milesimas(10_000), motivo: 'correccion' });
  if (caja) await negocio.abrirCaja($(50_000));
  return { negocio, cerveza, cafe };
}

async function ver(negocio: Negocio, hash = '#/mesas') {
  location.hash = hash;
  return montar(
    <ProveedorNegocio>
      <PantallaMesas />
    </ProveedorNegocio>,
    repoNuevo(),
    negocio,
  );
}

async function tocar(b: HTMLElement) {
  await act(async () => b.click());
  await esperar();
}

async function escribir(c: ParentNode, etiqueta: string, valor: string) {
  const label = [...c.querySelectorAll('label')].find((l) => l.textContent === etiqueta);
  const input = label && (c.querySelector(`#${CSS.escape(label.htmlFor)}`) as HTMLInputElement | null);
  if (!input) throw new Error(`No hay campo «${etiqueta}»`);
  await act(async () => {
    input.value = valor;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await esperar();
}

const texto = (c: HTMLElement) => c.textContent ?? '';

describe('Mesas: pantalla', () => {
  it('el dueño crea las mesas numeradas por zona y aparecen libres en el mapa', async () => {
    const { negocio } = await preparar();
    const c = await ver(negocio);
    expect(texto(c)).toContain('Todavía no hay mesas');
    await tocar(boton(c, 'Crear mesas'));
    await escribir(c, 'Hasta', '3');
    await escribir(c, 'Zona', 'Terraza');
    const dialogo = c.querySelector('[role="dialog"]') as HTMLElement;
    await tocar(boton(dialogo, 'Crear mesas'));
    await hastaQue(() => c.querySelectorAll('a.mesa').length === 3);
    const mesas = [...c.querySelectorAll('a.mesa')];
    expect(mesas.map((a) => a.getAttribute('aria-label'))).toEqual(['Mesa 1: Libre', 'Mesa 2: Libre', 'Mesa 3: Libre']);
    expect(texto(c)).toContain('Terraza');
    expect(texto(c)).toContain('0 de 3 ocupadas');
  });

  it('toma una ronda, la envía, pide la cuenta y cobra: descuenta inventario y libera la mesa', async () => {
    const { negocio, cerveza, cafe } = await preparar();
    const mesa = (await negocio.crearMesa({ nombre: 'Mesa 4', zona: 'Salón' })).id;
    const c = await ver(negocio, `#/mesas?mesa=${mesa}`);
    expect(c.querySelector('h1')?.textContent).toBe('Mesa 4');
    expect(texto(c)).toContain('Mesa libre');

    await tocar(boton(c, 'Añadir Cerveza'));
    await tocar(boton(c, 'Añadir Cerveza'));
    await tocar(boton(c, 'Añadir Café'));
    expect(texto(c)).toContain('Ronda nueva');
    await escribir(c, 'Nota para la barra o la cocina (opcional)', 'Sin hielo');
    await tocar(boton(c, 'Abrir cuenta y enviar'));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa) !== null);
    const cuenta = cuentaDeMesa(negocio.estado, mesa);
    expect(cuenta?.lineas).toEqual([
      { productoId: cerveza, cantidad: milesimas(2000) },
      { productoId: cafe, cantidad: milesimas(1000) },
    ]);
    expect(stockDe(negocio.estado, cerveza)).toBe(milesimas(10_000)); // pedir no descuenta
    expect(texto(c)).toContain('Pedido enviado');
    expect(texto(c)).toContain('$ 21.000');

    await tocar(boton(c, 'Pidió la cuenta'));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa)?.precuenta === true);

    await tocar(boton(c, 'Cobrar $ 21.000'));
    expect(c.querySelector('[role="dialog"]')?.textContent).toContain('Cobrar Mesa 4');
    await tocar(boton(c, 'Confirmar venta'));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa) === null);
    expect(stockDe(negocio.estado, cerveza)).toBe(milesimas(8000));
    expect(Object.values(negocio.estado.ventas)[0]?.total).toBe($(21_000));
    expect(texto(c)).toContain('La mesa queda libre');
  });

  it('quitar pide motivo y queda fuera de la cuenta', async () => {
    const { negocio, cerveza } = await preparar();
    const mesa = (await negocio.crearMesa({ nombre: 'Barra', zona: 'Barra' })).id;
    await negocio.pedirEnMesa(mesa, [{ productoId: cerveza, cantidad: milesimas(2000) }]);
    const c = await ver(negocio, `#/mesas?mesa=${mesa}`);
    await tocar(boton(c, 'Quitar Cerveza'));
    await escribir(c, 'Cantidad a quitar', '1');
    await tocar(boton(c, 'Quitar de la cuenta'));
    expect(c.querySelector('[role="alert"]')?.textContent).toContain('motivo');
    await escribir(c, 'Motivo', 'Se pidió por error');
    await tocar(boton(c, 'Quitar de la cuenta'));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa)?.lineas[0]?.cantidad === milesimas(1000));
    expect(cuentaDeMesa(negocio.estado, mesa)?.lineas).toEqual([{ productoId: cerveza, cantidad: milesimas(1000) }]);
  });

  it('el mapa muestra el estado de cada mesa y avisa si no hay caja', async () => {
    const { negocio, cerveza } = await preparar();
    const [m1, m2] = (await negocio.crearMesas({ prefijo: 'Mesa', desde: 1, hasta: 2, zona: 'Salón' })).map((e) => e.id);
    if (!m1 || !m2) throw new Error('sin mesas');
    await negocio.pedirEnMesa(m1, [{ productoId: cerveza, cantidad: milesimas(1000) }]);
    const cuenta = cuentaDeMesa(negocio.estado, m1);
    if (!cuenta) throw new Error('sin cuenta');
    await negocio.marcarPrecuenta(cuenta.id, true);
    const c = await ver(negocio);
    const etiquetas = [...c.querySelectorAll('a.mesa')].map((a) => a.getAttribute('aria-label'));
    expect(etiquetas).toEqual(['Mesa 1: Pidió la cuenta', 'Mesa 2: Libre']);
    expect(texto(c)).toContain('por cobrar $ 8.500');
    expect(c.querySelector(`a[href="#/mesas?mesa=${m2}"]`)).not.toBeNull();

    const sinCaja = await preparar({ caja: false });
    await sinCaja.negocio.crearMesa({ nombre: 'Mesa 1', zona: 'Salón' });
    const d = await ver(sinCaja.negocio);
    expect(texto(d)).toContain('abre la caja para atender mesas');
  });
});
