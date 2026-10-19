import { describe, expect, it } from 'vitest';
import { act } from 'preact/test-utils';
import type { ComponentChild } from 'preact';
import { centavos, milesimas, ReglaRota, stockDe, type Negocio } from '../../src/core/negocio';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { PantallaCaja } from '../../src/features/caja/PantallaCaja';
import { PantallaInicio } from '../../src/features/inicio/PantallaInicio';
import { PantallaVender } from '../../src/features/vender/PantallaVender';
import { PANTALLAS_VENTAS } from '../../src/features/registro/ventas';
import { boton, esperar, montar, negocioDePrueba, repoNuevo } from './ayuda';

const $ = (p: number) => centavos(p * 100);

/** Negocio con la dueña, dos productos con existencias y (opcional) la caja abierta. */
async function preparar({ caja = true } = {}) {
  const negocio = await negocioDePrueba();
  const cerveza = (await negocio.crearProducto({ nombre: 'Cerveza', categoria: 'Bebidas', unidad: 'unidad', precio: $(8500), stockMinimo: milesimas(2000) })).id;
  const cafe = (await negocio.crearProducto({ nombre: 'Café', categoria: 'Calientes', unidad: 'unidad', precio: $(4000) })).id;
  await negocio.ajustarInventario({ productoId: cerveza, delta: milesimas(10_000), motivo: 'correccion' });
  await negocio.ajustarInventario({ productoId: cafe, delta: milesimas(5000), motivo: 'correccion' });
  if (caja) await negocio.abrirCaja($(50_000));
  return { negocio, cerveza, cafe };
}

function ver(pantalla: ComponentChild, negocio: Negocio) {
  return montar(<ProveedorNegocio>{pantalla}</ProveedorNegocio>, repoNuevo(), negocio);
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

describe('ventas y caja: pantallas', () => {
  it('registra Inicio, Mesas, Reservas, Vender y Caja', () => {
    expect(Object.keys(PANTALLAS_VENTAS).sort()).toEqual(['caja', 'inicio', 'mesas', 'reservas', 'vender']);
  });

  it('Inicio saluda, ofrece abrir caja y muestra alertas y accesos según el cargo', async () => {
    const { negocio } = await preparar({ caja: false });
    await negocio.crearProducto({ nombre: 'Hielo', categoria: 'Varios', unidad: 'unidad', precio: $(2000), stockMinimo: milesimas(1000) });
    const c = await ver(<PantallaInicio />, negocio);
    expect(c.querySelector('h1')?.textContent).toBe('Hola, Dueña');
    expect(texto(c)).toContain('Bajo mínimo');
    expect(c.querySelector('a[href="#/contabilidad"]')).not.toBeNull();
    await tocar(boton(c, 'Abrir caja'));
    for (const d of ['2', '0', '000']) await tocar(boton(c, d));
    await tocar(c.querySelector('.teclado-numerico__confirmar') as HTMLElement);
    expect(negocio.estado.caja?.base).toBe($(20_000));
    expect(texto(c)).toContain('Abierta');
    expect(c.querySelector('a[href="#/caja/cerrar"]')).not.toBeNull();
  });

  it('abre la caja con la base escrita en el teclado', async () => {
    const { negocio } = await preparar({ caja: false });
    const c = await ver(<PantallaCaja />, negocio);
    expect(texto(c)).toContain('La caja está cerrada');
    for (const d of ['5', '0', '000']) await tocar(boton(c, d));
    await tocar(c.querySelector('.teclado-numerico__confirmar') as HTMLElement);
    expect(negocio.estado.caja?.base).toBe($(50_000));
    expect(texto(c)).toContain('Caja abierta');
    expect(texto(c)).toContain('Efectivo esperado');
  });

  it('sin caja abierta no se vende: la pantalla lo dice y ofrece abrirla', async () => {
    const { negocio, cerveza } = await preparar({ caja: false });
    const c = await ver(<PantallaVender />, negocio);
    expect(texto(c)).toContain('No hay caja abierta');
    expect(c.querySelector('.tarjeta-producto')).toBeNull();
    expect(boton(c, 'Abrir caja')).toBeTruthy();
    await expect(negocio.vender({ lineas: [{ productoId: cerveza, cantidad: milesimas(1000) }], pagos: [{ forma: 'efectivo' }] })).rejects.toBeInstanceOf(ReglaRota);
  });

  it('vende 2 productos con pago mixto (efectivo + transferencia): el stock baja y el pedido queda vacío', async () => {
    const { negocio, cerveza, cafe } = await preparar();
    await negocio.crearProducto({ nombre: 'Archivado', categoria: 'Bebidas', unidad: 'unidad', precio: $(1000) });
    const archivado = Object.values(negocio.estado.productos).find((p) => p.nombre === 'Archivado');
    if (archivado) await negocio.archivarProducto(archivado.id);
    const c = await ver(<PantallaVender />, negocio);
    expect(texto(c)).not.toContain('Archivado');

    await tocar(boton(c, 'Añadir Cerveza'));
    await tocar(boton(c, 'Añadir Cerveza'));
    await tocar(boton(c, 'Añadir Café'));
    expect(texto(c)).toContain('$ 21.000');
    await tocar(boton(c, 'Cobrar $ 21.000'));
    expect(c.querySelector('[role="dialog"]')?.textContent).toContain('Total a cobrar');

    await tocar(c.querySelector('.cobrar__libres button:nth-child(2)') as HTMLElement); // Transferencia
    expect(texto(c)).toContain('Transferencia: el resto');
    await escribir(c, 'Valor en efectivo', '10000');
    expect(texto(c)).toContain('$ 11.000'); // el resto
    await tocar(boton(c, '$ 20.000'));
    expect(c.querySelector('.cobrar__cambio')?.textContent).toContain('$ 10.000');
    await tocar(boton(c, 'Confirmar venta'));

    const [venta] = Object.values(negocio.estado.ventas);
    expect(venta?.total).toBe($(21_000));
    expect(venta?.pagos).toEqual([
      { forma: 'efectivo', monto: $(10_000) },
      { forma: 'transferencia', monto: $(11_000) },
    ]);
    expect(venta?.cambio).toBe($(10_000));
    expect(stockDe(negocio.estado, cerveza)).toBe(milesimas(8000));
    expect(stockDe(negocio.estado, cafe)).toBe(milesimas(4000));
    expect(c.querySelector('[role="status"]')?.textContent).toContain('Venta registrada');
    expect(c.querySelector('[role="dialog"]')).toBeNull();
    expect(texto(c)).toContain('El pedido está vacío');
  });

  it('descuento en porcentaje: la vista previa y lo guardado los calcula el núcleo', async () => {
    const { negocio } = await preparar();
    const c = await ver(<PantallaVender />, negocio);
    await tocar(boton(c, 'Añadir Cerveza'));
    await tocar(boton(c, '%'));
    await escribir(c, 'Descuento en porcentaje', '10');
    expect(texto(c)).toContain('−$ 850');
    await tocar(boton(c, 'Cobrar $ 7.650'));
    await tocar(boton(c, 'Confirmar venta'));
    const [venta] = Object.values(negocio.estado.ventas);
    expect(venta?.descuento).toEqual({ tipo: 'porcentaje', valor: 10, monto: $(850) });
    expect(venta?.total).toBe($(7650));
  });

  it('cierra la caja en pasos y guarda la diferencia (faltante) con su nota', async () => {
    const { negocio, cerveza } = await preparar();
    await negocio.vender({ lineas: [{ productoId: cerveza, cantidad: milesimas(1000) }], pagos: [{ forma: 'efectivo' }] });
    const c = await ver(<PantallaCaja />, negocio);
    await tocar(boton(c, 'Cerrar caja'));
    expect(texto(c)).toContain('Efectivo esperado en el cajón');
    expect(texto(c)).toContain('$ 58.500');
    await tocar(boton(c, 'Contar efectivo'));
    await escribir(c, 'Efectivo contado', '58000');
    await tocar(c.querySelector('.teclado-numerico__confirmar') as HTMLElement);
    expect(c.querySelector('.cierre__diferencia--faltante')?.textContent).toContain('-$ 500');
    await tocar(boton(c, 'Cerrar caja'));
    expect(c.querySelector('[role="alert"]')?.textContent).toContain('Hay diferencia');
    await escribir(c, 'Nota (obligatoria)', 'Se dio mal un cambio');
    await tocar(boton(c, 'Cerrar caja'));
    expect(c.querySelector('[role="alertdialog"]')?.textContent).toContain('faltan $ 500');
    await tocar(boton(c, 'Sí, cerrar caja'));
    expect(negocio.estado.caja).toBeNull();
    const [cierre] = negocio.estado.cierres;
    expect(cierre?.diferencia).toBe($(-500));
    expect(cierre?.nota).toBe('Se dio mal un cambio');
    expect(texto(c)).toContain('Caja cerrada');
    expect(c.querySelector('.tabla')?.textContent).toContain('Faltante');
  });

  it('entradas y retiros con motivo; el dueño ve la lista de movimientos', async () => {
    const { negocio } = await preparar();
    const c = await ver(<PantallaCaja />, negocio);
    await tocar(boton(c, 'Retiro de efectivo'));
    await escribir(c, 'Motivo', 'Consignación');
    await escribir(c, 'Valor', '20000');
    await tocar(boton(c, 'Guardar'));
    expect(negocio.estado.caja?.retiros).toBe($(20_000));
    expect(texto(c)).toContain('Retiro de $ 20.000 guardado');
    await esperar();
    expect(c.querySelector('[aria-labelledby="caja-movimientos"]')?.textContent).toContain('Consignación');
  });

  it('el cajero no ve «Anular»; el dueño anula con motivo y el inventario vuelve', async () => {
    const { negocio, cerveza } = await preparar();
    await negocio.vender({ lineas: [{ productoId: cerveza, cantidad: milesimas(2000) }], pagos: [{ forma: 'tarjeta' }] });
    const cajero = await negocio.crearUsuario({ nombre: 'Caro', rol: 'cajero', pin: '5678' });
    const r = await negocio.iniciarSesion(cajero.id, '5678');
    expect(r.ok).toBe(true);

    const c = await ver(<PantallaVender />, negocio);
    await tocar([...c.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.startsWith('Ventas de hoy')) as HTMLElement);
    expect(texto(c)).toContain('$ 17.000');
    expect([...c.querySelectorAll('button')].some((b) => b.textContent === 'Anular')).toBe(false);

    const dueno = Object.values(negocio.estado.usuarios).find((u) => u.rol === 'dueno');
    await act(async () => {
      await negocio.iniciarSesion(dueno?.id ?? '', '1234');
    });
    await esperar();
    await tocar(boton(c, 'Anular'));
    await tocar(boton(c, 'Anular venta'));
    expect(c.querySelector('[role="alertdialog"]')?.textContent).toContain('Escribe el motivo');
    await escribir(c, 'Motivo', 'Se cobró dos veces');
    await tocar(boton(c, 'Anular venta'));
    expect(Object.values(negocio.estado.ventas)[0]?.anulada).toBe(true);
    expect(stockDe(negocio.estado, cerveza)).toBe(milesimas(10_000));
    expect(texto(c)).toContain('Anulada');
  });
});
