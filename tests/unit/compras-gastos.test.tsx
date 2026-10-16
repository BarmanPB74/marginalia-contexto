import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAlmacen, DiscoMemoria, type Almacen } from '../../src/core/almacen/almacen';
import { centavos, stockDe, type Negocio } from '../../src/core/negocio';
import { leerAdjunto } from '../../src/features/adjuntos/adjuntos';
import { AlmacenAdjuntos, ReductorAdjuntos } from '../../src/features/adjuntos/componentes';
import { PantallaCompras } from '../../src/features/compras/PantallaCompras';
import { marcasDe } from '../../src/features/compras/marcas';
import { desdePeriodo, PantallaGastos } from '../../src/features/gastos/PantallaGastos';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { boton, esperar, montar, negocioDePrueba, repoNuevo } from './ayuda';

const $ = (p: number) => centavos(p * 100);
/** PNG mínimo (solo la firma y relleno): basta para validar por contenido. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

let almacen: Almacen;
const creadas: string[] = [];
const revocadas: string[] = [];

beforeEach(() => {
  almacen = crearAlmacen(new DiscoMemoria());
  creadas.length = 0;
  revocadas.length = 0;
  // jsdom no trae URL.createObjectURL: se simula para ver que se crea y se revoca
  Object.assign(URL, {
    createObjectURL: vi.fn(() => {
      const u = `blob:prueba/${creadas.length}`;
      creadas.push(u);
      return u;
    }),
    revokeObjectURL: vi.fn((u: string) => revocadas.push(u)),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Pantalla con el negocio de prueba, adjuntos en memoria y sin canvas. */
function conProveedores(vista: preact.ComponentChild) {
  return (
    <AlmacenAdjuntos.Provider value={almacen}>
      <ReductorAdjuntos.Provider value={() => Promise.resolve(null)}>
        <ProveedorNegocio>{vista}</ProveedorNegocio>
      </ReductorAdjuntos.Provider>
    </AlmacenAdjuntos.Provider>
  );
}

/** El elemento existe (sin `!`: la regla de lint lo prohíbe). */
function hay<T>(x: T | null | undefined): T {
  if (x === null || x === undefined) throw new Error('Falta un elemento en la pantalla');
  return x;
}

function campo(c: ParentNode, etiqueta: string): HTMLInputElement {
  const label = [...c.querySelectorAll('label')].find((l) => l.textContent?.trim() === etiqueta);
  const el = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!el) throw new Error(`No hay campo «${etiqueta}»`);
  return el as HTMLInputElement;
}

async function escribir(el: HTMLInputElement, valor: string) {
  await act(async () => {
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await esperar();
}

async function tocar(el: HTMLElement) {
  await act(async () => el.click());
  await esperar();
}

async function adjuntar(c: ParentNode, etiqueta: string, archivo: File) {
  const entrada = hay(c.querySelector<HTMLInputElement>(`input[type=file][aria-label="${etiqueta}"]`));
  await act(async () => {
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await esperar();
}

async function negocioConProductos(): Promise<{ negocio: Negocio; cerveza: string }> {
  const negocio = await negocioDePrueba();
  const cerveza = (await negocio.crearProducto({ nombre: 'Cerveza', categoria: 'Bebidas', unidad: 'unidad', precio: $(8500), costo: $(3000) })).id;
  await negocio.crearProducto({ nombre: 'Queso', categoria: 'Cocina', unidad: 'kg', precio: $(40000) });
  return { negocio, cerveza };
}

describe('Compras y facturas', () => {
  it('factura con foto → aplicar (una vez) → existencias suben → pago parcial → saldo', async () => {
    const { negocio, cerveza } = await negocioConProductos();
    location.hash = '#/compras?nueva';
    const c = await montar(conProveedores(<PantallaCompras />), repoNuevo(), negocio);
    expect(c.querySelector('h1')?.textContent).toBe('Nueva factura');

    await escribir(campo(c, 'Proveedor'), 'Distribuidora del Valle');
    await escribir(campo(c, 'Número de factura'), 'FV-77');
    await escribir(hay(c.querySelector<HTMLInputElement>('input[type=search]')), 'cerv');
    await tocar(hay(c.querySelector<HTMLButtonElement>('.inv-buscados button')));
    expect(campo(c, 'Costo unitario').value).toBe('3000');
    await escribir(campo(c, 'Cantidad de Cerveza'), '24');
    await escribir(campo(c, 'Costo unitario'), '3.200');
    expect(c.querySelector('.inv-total')?.textContent).toMatch(/\$ 76\.800/);

    // La cámara usa `capture`; la galería no
    expect(c.querySelector('input[aria-label="Tomar foto"]')?.getAttribute('capture')).toBe('environment');
    expect(c.querySelector('input[aria-label="Elegir foto o PDF"]')?.hasAttribute('capture')).toBe(false);
    await adjuntar(c, 'Elegir foto o PDF', new File(['<html>'], 'falsa.jpg', { type: 'image/jpeg' }));
    expect(c.querySelector('.adjuntos__error')?.textContent).toMatch(/Solo se aceptan fotos/);
    await adjuntar(c, 'Elegir foto o PDF', new File([PNG], 'factura.png', { type: 'image/png' }));
    expect(c.querySelectorAll('.adjuntos__item')).toHaveLength(1);

    await tocar(boton(c, 'Registrar factura'));
    const compra = hay(Object.values(negocio.estado.compras)[0]);
    expect(compra).toMatchObject({ proveedor: 'Distribuidora del Valle', numero: 'FV-77', total: 7680000, estado: 'registrada' });
    expect(compra.adjuntos).toHaveLength(1);
    expect((await leerAdjunto(almacen, hay(compra.adjuntos[0])))?.tipo).toBe('image/png');
    expect(location.hash).toBe(`#/compras?factura=${compra.id}`);
    await esperar();

    // Ficha: la foto se ve con una URL blob: y el inventario aún no cambia
    expect(c.querySelector('h1')?.textContent).toBe('Factura FV-77');
    expect(c.querySelector<HTMLImageElement>('.adjuntos__imagen')?.src).toMatch(/^blob:/);
    expect(stockDe(negocio.estado, cerveza)).toBe(0);

    await tocar(boton(c, 'Aplicar al inventario'));
    expect(c.querySelector('[role=alertdialog]')?.textContent).toMatch(/una sola vez/);
    await tocar(boton(c, 'Aplicar'));
    expect(stockDe(negocio.estado, cerveza)).toBe(24000);
    expect(negocio.estado.productos[cerveza]?.costo).toBe(320000);
    expect(() => boton(c, 'Aplicar al inventario')).toThrow();

    await tocar(boton(c, 'Pagar'));
    expect(campo(c, 'Valor del pago').value).toBe('76800');
    await escribir(campo(c, 'Valor del pago'), '50.000');
    await tocar(boton(c, 'Registrar pago'));
    expect(negocio.estado.compras[compra.id]).toMatchObject({ pagado: 5000000, saldo: 2680000 });
    await esperar();
    const saldo = [...c.querySelectorAll('.cifra')].find((x) => x.textContent?.includes('Saldo'));
    expect(saldo?.textContent).toMatch(/\$ 26\.800/);
    expect([...c.querySelectorAll('tbody tr')].some((t) => /Efectivo.*Dueña.*\$ 50\.000/.test(t.textContent ?? ''))).toBe(true);

    // Lista: la factura aparece aplicada y con saldo; al salir se revocan las URL blob:
    location.hash = '#/compras';
    await esperar();
    expect(c.textContent).toMatch(/Distribuidora del Valle · FV-77/);
    expect(c.textContent).toMatch(/Con saldo/);
    expect(revocadas).toEqual(expect.arrayContaining(creadas));
  });

  it('marca vencida la factura con saldo después de su vencimiento', () => {
    const base = { estado: 'registrada', saldo: $(10), vence: '2026-10-01' } as const;
    expect(marcasDe(base as never, '2026-10-16')).toEqual(['porAplicar', 'conSaldo', 'vencida']);
    expect(marcasDe({ ...base, saldo: 0, estado: 'aplicada' } as never, '2026-10-16')).toEqual(['aplicada', 'pagada']);
    expect(marcasDe({ ...base, estado: 'anulada' } as never, '2026-10-16')).toEqual(['anulada']);
  });

  it('el cajero no ve las facturas', async () => {
    const { negocio } = await negocioConProductos();
    const cajero = await negocio.crearUsuario({ nombre: 'Caja', rol: 'cajero', pin: '5678' });
    await negocio.iniciarSesion(cajero.id, '5678');
    location.hash = '#/compras';
    const c = await montar(conProveedores(<PantallaCompras />), repoNuevo(), negocio);
    expect(c.textContent).toMatch(/no ve las facturas/);
    expect(c.querySelector('.boton-flotante')).toBeNull();
  });
});

describe('Gastos', () => {
  it('gasto pagado desde la caja: baja el efectivo esperado; se anula con motivo', async () => {
    const negocio = await negocioDePrueba();
    await negocio.abrirCaja($(100000));
    location.hash = '#/gastos';
    const c = await montar(conProveedores(<PantallaGastos />), repoNuevo(), negocio);
    expect(c.textContent).toMatch(/Aún no hay gastos/);

    await tocar(boton(c, 'Nuevo gasto'));
    await escribir(campo(c, 'Valor'), '12.000');
    await tocar(boton(c, 'Domicilios'));
    await escribir(campo(c, 'Descripción'), 'Hielo');
    expect(c.querySelector('.hoja [role=switch]')?.getAttribute('aria-checked')).toBe('true');
    await adjuntar(c, 'Elegir foto o PDF', new File([PNG], 'recibo.png'));
    await tocar(boton(c, 'Registrar gasto'));

    const g = hay(Object.values(negocio.estado.gastos)[0]);
    expect(g).toMatchObject({ categoria: 'Domicilios', descripcion: 'Hielo', monto: 1200000, forma: 'efectivo', deCaja: true });
    expect(g.adjunto).toBeTruthy();
    expect(negocio.resumenCierre()?.gastos).toBe(1200000);
    expect(negocio.resumenCierre()?.esperado).toBe(8800000);
    expect(c.textContent).toMatch(/Hielo/);
    expect(c.querySelector('.cifra')?.textContent).toMatch(/\$ 12\.000/);

    await tocar(boton(c, 'Ver soporte de Hielo'));
    expect(c.querySelector('.adjuntos__imagen')).toBeTruthy();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await esperar();

    await tocar(boton(c, 'Anular Hielo'));
    await tocar(hay(c.querySelector<HTMLButtonElement>('.dialogo .boton--peligro')));
    expect(c.textContent).toMatch(/Escribe el motivo/);
    await escribir(campo(c, 'Motivo'), 'era de otro día');
    await tocar(hay(c.querySelector<HTMLButtonElement>('.dialogo .boton--peligro')));
    expect(negocio.estado.gastos[g.id]?.anulado).toBe(true);
    expect(negocio.resumenCierre()?.gastos).toBe(0);
  });

  it('sin caja abierta, el gasto del dueño no sale de la caja', async () => {
    const negocio = await negocioDePrueba();
    location.hash = '#/gastos';
    const c = await montar(conProveedores(<PantallaGastos />), repoNuevo(), negocio);
    await tocar(boton(c, 'Nuevo gasto'));
    expect(c.querySelector('.hoja [role=switch]')?.getAttribute('aria-checked')).toBe('false');
    await escribir(campo(c, 'Valor'), '1.500.000');
    await tocar(boton(c, 'Arriendo'));
    await tocar(boton(c, 'Transferencia'));
    await tocar(boton(c, 'Registrar gasto'));
    expect(Object.values(negocio.estado.gastos)[0]).toMatchObject({ categoria: 'Arriendo', descripcion: 'Arriendo', forma: 'transferencia', deCaja: false });
  });

  it('el cajero solo registra gastos de la caja, en efectivo', async () => {
    const negocio = await negocioDePrueba();
    const cajero = await negocio.crearUsuario({ nombre: 'Caja', rol: 'cajero', pin: '5678' });
    await negocio.iniciarSesion(cajero.id, '5678');
    await negocio.abrirCaja($(50000));
    location.hash = '#/gastos';
    const c = await montar(conProveedores(<PantallaGastos />), repoNuevo(), negocio);
    await tocar(boton(c, 'Nuevo gasto'));
    expect(c.textContent).not.toMatch(/Transferencia/);
    const interruptor = hay(c.querySelector<HTMLButtonElement>('.hoja [role=switch]'));
    expect(interruptor.getAttribute('aria-checked')).toBe('true');
    expect(interruptor.disabled).toBe(true);
    await escribir(campo(c, 'Valor'), '3000');
    await tocar(boton(c, 'Aseo'));
    await tocar(boton(c, 'Registrar gasto'));
    expect(Object.values(negocio.estado.gastos)[0]).toMatchObject({ deCaja: true, forma: 'efectivo', monto: 300000 });
    expect(c.textContent).not.toMatch(/Anular/);
  });

  it('el período empieza hoy, hace 6 días o el primero del mes', () => {
    const ahora = new Date(2026, 9, 16, 10);
    expect(desdePeriodo('hoy', ahora)).toBe('2026-10-16');
    expect(desdePeriodo('semana', ahora)).toBe('2026-10-10');
    expect(desdePeriodo('mes', ahora)).toBe('2026-10-01');
    expect(desdePeriodo('todo', ahora)).toBeNull();
  });
});
