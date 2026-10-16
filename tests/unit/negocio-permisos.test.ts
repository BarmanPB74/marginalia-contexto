import { describe, expect, it } from 'vitest';
import { ACCIONES, NOMBRE_ACCION, PERMISOS, puede, ROLES, SinPermiso, type Accion } from '../../src/core/negocio';
import { $, entrarComo, montar, u, volverADueno } from './negocio-ayuda';

describe('tabla de permisos', () => {
  it('toda acción está clasificada y tiene nombre; la tabla no tiene acciones de más', () => {
    expect(Object.keys(PERMISOS).sort()).toEqual([...ACCIONES].sort());
    for (const a of ACCIONES) {
      expect(PERMISOS[a].length, a).toBeGreaterThan(0);
      expect(PERMISOS[a].every((r) => (ROLES as readonly string[]).includes(r)), a).toBe(true);
      expect(NOMBRE_ACCION[a], a).toBeTruthy();
    }
  });

  it('el dueño puede todo', () => {
    for (const a of ACCIONES) expect(puede('dueno', a), a).toBe(true);
  });

  it('cajero: caja, ventas y gastos de caja; nada de anular, precios, costos ni contabilidad', () => {
    const si: Accion[] = ['caja.abrir', 'caja.cerrar', 'caja.movimiento', 'venta.registrar', 'gasto.registrarDeCaja', 'inventario.ver'];
    const no: Accion[] = ['venta.anular', 'inventario.verCostos', 'producto.editarPrecio', 'contabilidad.ver', 'pago.factura', 'usuario.crear', 'inventario.ajustar', 'compra.registrar'];
    for (const a of si) expect(puede('cajero', a), a).toBe(true);
    for (const a of no) expect(puede('cajero', a), a).toBe(false);
  });

  it('bodega: inventario y compras; ni ventas ni contabilidad ni pagos', () => {
    const si: Accion[] = ['inventario.ajustar', 'inventario.contar', 'inventario.importar', 'compra.registrar', 'compra.aplicar', 'inventario.verCostos'];
    const no: Accion[] = ['venta.registrar', 'caja.abrir', 'contabilidad.ver', 'pago.factura', 'venta.anular', 'producto.editarPrecio', 'gasto.registrarDeCaja'];
    for (const a of si) expect(puede('bodega', a), a).toBe(true);
    for (const a of no) expect(puede('bodega', a), a).toBe(false);
  });

  it('un cargo o una acción desconocidos no pueden nada', () => {
    expect(puede('mesero' as never, 'venta.registrar')).toBe(false);
    expect(puede('dueno', 'toString' as never)).toBe(false);
  });
});

describe('permisos en el servicio', () => {
  it('el cajero vende pero no anula', async () => {
    const m = await montar();
    await m.negocio.ajustarInventario({ productoId: m.cerveza, delta: u(10), motivo: 'correccion' });
    await entrarComo(m, 'Ana', 'cajero');
    await m.negocio.abrirCaja($(100000));
    const venta = await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] });
    await expect(m.negocio.anularVenta(venta.id, 'error')).rejects.toThrow(SinPermiso);
    await expect(m.negocio.anularVenta(venta.id, 'error')).rejects.toThrow('no permite anular ventas');
    expect(m.negocio.estado.ventas[venta.id]?.anulada).toBe(false);
    await volverADueno(m);
    await m.negocio.anularVenta(venta.id, 'error');
    expect(m.negocio.estado.ventas[venta.id]?.anulada).toBe(true);
  });

  it('el cajero no cambia precios; bodega cambia el nombre pero no el precio', async () => {
    const m = await montar();
    await entrarComo(m, 'Ana', 'cajero');
    await expect(m.negocio.editarProducto(m.cerveza, { precio: $(1) })).rejects.toThrow(SinPermiso);
    await volverADueno(m);
    await entrarComo(m, 'Beto', 'bodega');
    await m.negocio.editarProducto(m.cerveza, { nombre: 'Cerveza Club' });
    await expect(m.negocio.editarProducto(m.cerveza, { costo: $(1) })).rejects.toThrow(SinPermiso);
    await expect(m.negocio.contabilidad({ desde: '2026-10-01', hasta: '2026-10-31' })).rejects.toThrow(SinPermiso);
    expect(m.negocio.estado.productos[m.cerveza]?.nombre).toBe('Cerveza Club');
  });

  it('sin sesión no se escribe nada', async () => {
    const m = await montar();
    m.negocio.cerrarSesion();
    await expect(m.negocio.abrirCaja($(0))).rejects.toThrow('Inicia sesión');
    expect(m.negocio.estado.caja).toBeNull();
  });

  it('un usuario desactivado pierde la sesión', async () => {
    const m = await montar();
    const ana = await entrarComo(m, 'Ana', 'cajero');
    await volverADueno(m);
    await m.negocio.desactivarUsuario(ana);
    expect((await m.negocio.iniciarSesion(ana, '5678')).ok).toBe(false);
  });
});
