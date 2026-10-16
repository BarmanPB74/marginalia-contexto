import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { centavos, milesimas, Negocio, SinPermiso } from '../../src/core/negocio';

async function preparar() {
  const n = await Negocio.crear(crearAlmacen(new DiscoMemoria()), { iteracionesPin: 1000 });
  await n.crearUsuario({ nombre: 'Dueña', rol: 'dueno', pin: '1234' });
  await n.crearUsuario({ nombre: 'Caro', rol: 'cajero', pin: '5678' });
  const p = await n.crearProducto({ nombre: 'Tinto', categoria: 'Calientes', unidad: 'unidad', precio: centavos(300000) });
  await n.ajustarInventario({ productoId: p.id, delta: milesimas(10000), motivo: 'correccion' });
  const cajero = n.usuarios().find((u) => u.nombre === 'Caro');
  if (!cajero) throw new Error('sin cajero');
  return { n, productoId: p.id, cajeroId: cajero.id };
}

describe('caja: descuentos y movimientos para quien maneja la caja', () => {
  it('el cajero no puede hacer descuentos; el dueño sí', async () => {
    const { n, productoId, cajeroId } = await preparar();
    await n.abrirCaja(centavos(0));
    const venta = { lineas: [{ productoId, cantidad: milesimas(1000) }], descuento: { tipo: 'porcentaje' as const, valor: 10 }, pagos: [{ forma: 'efectivo' as const }] };
    n.cerrarSesion();
    await n.iniciarSesion(cajeroId, '5678');
    await expect(n.vender(venta)).rejects.toBeInstanceOf(SinPermiso);
    await n.vender({ ...venta, descuento: null });
    expect(n.estado.caja?.ventas).toBe(1);
  });

  it('el cajero ve los movimientos de la caja abierta, lo más reciente primero', async () => {
    const { n, cajeroId } = await preparar();
    await n.abrirCaja(centavos(5000000));
    await n.movimientoCaja({ tipo: 'ingreso', monto: centavos(2000000), motivo: 'Sencillo' });
    await n.registrarGasto({ categoria: 'Aseo', descripcion: 'Jabón', monto: centavos(800000), forma: 'efectivo', deCaja: true });
    n.cerrarSesion();
    await n.iniciarSesion(cajeroId, '5678');
    const lista = await n.movimientosCaja();
    expect(lista.map((m) => [m.tipo, m.detalle])).toEqual([
      ['gasto', 'Jabón'],
      ['ingreso', 'Sencillo'],
    ]);
    expect(lista[1]?.por).toBe('Dueña');
  });
});
