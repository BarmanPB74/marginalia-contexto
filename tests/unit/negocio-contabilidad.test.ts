import { describe, expect, it } from 'vitest';
import { aCsv, FORMAS_PAGO, movimientosStock, resumen, resumenACsv, ventasACsv } from '../../src/core/negocio';
import { $, montar, u, type Montaje } from './negocio-ayuda';

const OCTUBRE = { desde: '2026-10-01', hasta: '2026-10-31' };

async function unDia(m: Montaje) {
  const c = await m.negocio.registrarCompra({
    proveedor: 'Distri',
    numero: 'F-1',
    fecha: '2026-10-16',
    vence: '2026-10-30',
    lineas: [{ productoId: m.cerveza, cantidad: u(24), costoUnit: $(3200) }],
  });
  await m.negocio.aplicarCompra(c.id);
  await m.negocio.pagarFactura({ compraId: c.id, monto: $(30000), forma: 'transferencia', deCaja: false });
  await m.negocio.abrirCaja($(50000));
  await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(2) }], pagos: [{ forma: 'efectivo' }] }); // 17.000
  await m.negocio.vender({
    lineas: [{ productoId: m.cerveza, cantidad: u(1) }, { productoId: m.queso, cantidad: u(0.5) }],
    descuento: { tipo: 'valor', valor: $(1500) },
    pagos: [{ forma: 'tarjeta' }],
  }); // 8.500 + 20.000 − 1.500 = 27.000
  await m.negocio.vender({ lineas: [{ productoId: m.cafe, cantidad: u(1) }], pagos: [{ forma: 'cortesia' }] }); // 4.000 cortesía
  const anulada = await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(5) }], pagos: [{ forma: 'efectivo' }] });
  await m.negocio.anularVenta(anulada.id, 'Error de digitación');
  await m.negocio.registrarGasto({ categoria: 'Aseo', descripcion: 'Jabón', monto: $(7000), forma: 'efectivo', deCaja: true });
  const g = await m.negocio.registrarGasto({ categoria: 'Servicios', descripcion: 'Internet', monto: $(90000), forma: 'transferencia', deCaja: false });
  await m.negocio.registrarGasto({ categoria: 'Aseo', descripcion: 'Escoba', monto: $(12000), forma: 'tarjeta', deCaja: false });
  await m.negocio.anularGasto(g.id, 'Duplicado');
  // esperado = 50.000 + 17.000 − 7.000 = 60.000; contado 59.500
  await m.negocio.cerrarCaja({ contado: $(59500), confirmar: true });
}

describe('contabilidad', () => {
  it('los totales cuadran entre sí', async () => {
    const m = await montar();
    await unDia(m);
    const r = await m.negocio.contabilidad(OCTUBRE);
    expect(r.ventas.cantidad).toBe(3);
    expect(r.ventas.anuladas).toBe(1);
    expect(r.ventas.bruto).toBe($(17000 + 28500 + 4000));
    expect(r.ventas.descuentos).toBe($(1500));
    expect(r.ventas.netas).toBe($(48000));
    expect(r.ventas.bruto - r.ventas.descuentos).toBe(r.ventas.netas);
    expect(FORMAS_PAGO.reduce((s, f) => s + r.ventas.porForma[f], 0)).toBe(r.ventas.netas);
    expect(r.ventas.porForma).toEqual({ efectivo: $(17000), tarjeta: $(27000), transferencia: 0, cortesia: $(4000) });
    expect(r.ventas.ingresoReal).toBe($(44000));
    expect(r.porProducto.reduce((s, p) => s + p.ingreso, 0)).toBe(r.ventas.bruto);
    expect(r.porProducto[0]).toMatchObject({ productoId: m.cerveza, cantidad: u(3), ingreso: $(25500) });

    // Costo vigente: cerveza 3 × 3.200, café 1 × 1.000; el queso no tiene costo.
    expect(r.costoAproximado).toBe(true);
    expect(r.costoVentas).toBe($(9600 + 1000));
    expect(r.productosSinCosto).toEqual(['Queso']);
    expect(r.margenBruto).toBe(r.ventas.ingresoReal - r.costoVentas);

    expect(r.gastos).toEqual({ total: $(19000), porCategoria: { Aseo: $(19000) } });
    expect(r.pagosProveedores.total).toBe($(30000));
    expect(r.compras).toEqual({ cantidad: 1, total: $(76800) });
    expect(r.cuentasPorPagar).toHaveLength(1);
    expect(r.totalPorPagar).toBe($(76800 - 30000));
    expect(r.cuadres).toHaveLength(1);
    expect(r.cuadres[0]).toMatchObject({ esperado: $(60000), contado: $(59500), diferencia: -$(500) });
    expect(r.diferenciaCajas).toBe(-$(500));
    expect(r.resultadoAproximado).toBe(r.margenBruto - r.gastos.total);
  });

  it('el período filtra por fecha local', async () => {
    const m = await montar();
    await unDia(m);
    const eventos = await m.negocio.eventos();
    const otro = resumen(eventos, m.negocio.estado, { desde: '2026-10-17', hasta: '2026-10-31' });
    expect(otro.ventas.cantidad).toBe(0);
    expect(otro.cuadres).toHaveLength(0);
    expect(otro.cuentasPorPagar).toHaveLength(1); // lo que se debe no depende del período
  });

  it('el rastro de stock explica la existencia', async () => {
    const m = await montar();
    await unDia(m);
    const rastro = movimientosStock(await m.negocio.eventos(), m.cerveza, m.negocio.estado);
    expect(rastro.map((x) => x.tipo)).toEqual(['compra', 'venta', 'venta', 'venta', 'anulacion']);
    expect(rastro.reduce((s, x) => s + x.delta, 0)).toBe(m.negocio.estado.stock[m.cerveza]);
  });
});

describe('CSV', () => {
  it('usa ; y escapa comillas, saltos y separadores', () => {
    expect(aCsv([['a', 'b;c', 'd"e', 'f\ng', 1, null]])).toBe('a;"b;c";"d""e";"f\ng";1;\r\n');
    expect(aCsv([['ñ']], { bom: true }).startsWith('﻿')).toBe(true);
  });

  it('protege contra inyección de fórmulas sin dañar números negativos', () => {
    const csv = aCsv([['=HYPERLINK("http://x")', '+57 300', '-1+2', '@SUM(A1)', '\tx', '-8500,50', '-120', 'Normal']]);
    const celdas = csv.trimEnd().split(';');
    expect(celdas[0]).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(celdas[1]).toBe("'+57 300");
    expect(celdas[2]).toBe("'-1+2");
    expect(celdas[3]).toBe("'@SUM(A1)");
    expect(celdas[4]).toBe("'\tx");
    expect(celdas[5]).toBe('-8500,50');
    expect(celdas[6]).toBe('-120');
    expect(celdas[7]).toBe('Normal');
  });

  it('el resumen y el detalle de ventas exportan sin fórmulas aunque un nombre sea hostil', async () => {
    const m = await montar();
    await m.negocio.editarProducto(m.cafe, { nombre: '=cmd|calc' });
    await unDia(m);
    const r = await m.negocio.contabilidad(OCTUBRE);
    const csv = resumenACsv(r);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain('Diferencia total;;-500');
    for (const linea of csv.split('\r\n')) for (const c of linea.split(';')) expect(/^[=+@]/.test(c), c).toBe(false);
    const detalle = ventasACsv(await m.negocio.eventos(), OCTUBRE);
    expect(detalle.split('\r\n').filter(Boolean)).toHaveLength(1 + 4); // encabezado + 4 líneas vendidas
    expect(detalle).toContain("'=cmd|calc");
  });
});
