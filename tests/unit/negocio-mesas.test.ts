import { describe, expect, it } from 'vitest';
import { cuentaDeMesa, leerComando, puede, stockDe, type Cuenta } from '../../src/core/negocio';
import { $, abrir, entrarComo, montar, u, volverADueno, type Montaje } from './negocio-ayuda';

/** Negocio con stock, caja abierta y dos mesas en el salón y una en la terraza. */
async function conMesas() {
  const m = await montar();
  await m.negocio.ajustarInventario({ productoId: m.cerveza, delta: u(24), motivo: 'correccion' });
  await m.negocio.ajustarInventario({ productoId: m.cafe, delta: u(10), motivo: 'correccion' });
  await m.negocio.abrirCaja($(100000));
  const [mesa1, mesa2] = (await m.negocio.crearMesas({ prefijo: 'Mesa', desde: 1, hasta: 2, zona: 'Salón' })).map((e) => e.id);
  if (!mesa1 || !mesa2) throw new Error('sin mesas');
  const t1 = await m.negocio.crearMesa({ nombre: 'Terraza 1', zona: 'Terraza' });
  return { m, mesa1, mesa2, terraza: t1.id };
}

function cuenta(m: Montaje, mesaId: string): Cuenta {
  const c = cuentaDeMesa(m.negocio.estado, mesaId);
  if (!c) throw new Error('sin cuenta');
  return c;
}

describe('mesas y cuentas', () => {
  it('crea mesas numeradas sin repetir nombres', async () => {
    const { m } = await conMesas();
    const nuevas = await m.negocio.crearMesas({ prefijo: 'Mesa', desde: 1, hasta: 4, zona: 'Salón' });
    expect(nuevas).toHaveLength(2); // 1 y 2 ya existían
    expect(Object.values(m.negocio.estado.mesas).map((x) => x.nombre).sort()).toEqual(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Terraza 1']);
    await expect(m.negocio.crearMesa({ nombre: 'mesa 3', zona: 'Salón' })).rejects.toThrow('Ya hay una mesa');
    await expect(m.negocio.crearMesas({ prefijo: 'Mesa', desde: 3, hasta: 1, zona: 'x' })).rejects.toThrow('menor al mayor');
  });

  it('el primer pedido abre la cuenta; las rondas se suman y no tocan el inventario', async () => {
    const { m, mesa1 } = await conMesas();
    const evs = await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cerveza, cantidad: u(2) }], { personas: 4 });
    expect(evs.map((e) => e.tipo)).toEqual(['cuenta.abierta', 'cuenta.pedido']);
    await m.negocio.pedirEnMesa(mesa1, [
      { productoId: m.cerveza, cantidad: u(1) },
      { productoId: m.cafe, cantidad: u(1) },
      { productoId: m.cafe, cantidad: u(1) },
    ]);
    const c = cuenta(m, mesa1);
    expect(c.personas).toBe(4);
    expect(c.rondas).toBe(2);
    expect(c.lineas).toEqual([
      { productoId: m.cerveza, cantidad: u(3) },
      { productoId: m.cafe, cantidad: u(2) },
    ]);
    expect(stockDe(m.negocio.estado, m.cerveza)).toBe(u(24));
  });

  it('sin caja abierta no se atienden mesas', async () => {
    const m = await montar();
    const mesa = await m.negocio.crearMesa({ nombre: 'Barra', zona: 'Barra' });
    await expect(m.negocio.pedirEnMesa(mesa.id, [{ productoId: m.cerveza, cantidad: u(1) }])).rejects.toThrow('No hay caja abierta');
  });

  it('cobrar la cuenta descuenta el inventario, suma a la caja y libera la mesa', async () => {
    const { m, mesa1 } = await conMesas();
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cerveza, cantidad: u(2) }, { productoId: m.cafe, cantidad: u(1) }]);
    const c = cuenta(m, mesa1);
    const venta = await m.negocio.cobrarCuenta({ cuentaId: c.id, pagos: [{ forma: 'efectivo' }], recibido: $(30000) });
    expect(venta.tipo).toBe('venta.registrada');
    if (venta.tipo !== 'venta.registrada') return;
    expect(venta.datos.total).toBe($(21000));
    expect(venta.datos.cambio).toBe($(9000));
    expect(venta.datos.cuentaId).toBe(c.id);
    expect(cuentaDeMesa(m.negocio.estado, mesa1)).toBeNull();
    expect(stockDe(m.negocio.estado, m.cerveza)).toBe(u(22));
    expect(m.negocio.estado.caja?.ventasPorForma.efectivo).toBe($(21000));
    await expect(m.negocio.cobrarCuenta({ cuentaId: c.id, pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('ya se cobró');
  });

  it('cobra con los precios vigentes y rechaza una venta que no coincide con la cuenta', async () => {
    const { m, mesa1 } = await conMesas();
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cerveza, cantidad: u(2) }]);
    await m.negocio.editarProducto(m.cerveza, { precio: $(9000) });
    const c = cuenta(m, mesa1);
    const comando = leerComando({
      tipo: 'venta.registrada',
      datos: {
        cajaId: m.negocio.estado.caja?.id,
        lineas: [{ productoId: m.cerveza, nombre: 'Cerveza', cantidad: 1000, precioUnit: 900000, subtotal: 900000 }],
        total: 900000,
        pagos: [{ forma: 'efectivo', monto: 900000 }],
        cuentaId: c.id,
      },
    });
    await expect(m.negocio.ejecutar(comando)).rejects.toThrow('cambió mientras cobrabas');
    const v = await m.negocio.cobrarCuenta({ cuentaId: c.id, pagos: [{ forma: 'tarjeta' }] });
    expect(v.tipo === 'venta.registrada' && v.datos.total).toBe($(18000));
  });

  it('quitar exige motivo y no más de lo pedido; quitarlo todo deja la cuenta vacía para liberar', async () => {
    const { m, mesa1 } = await conMesas();
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cerveza, cantidad: u(2) }]);
    const c = cuenta(m, mesa1);
    await expect(m.negocio.quitarDeCuenta({ cuentaId: c.id, productoId: m.cerveza, cantidad: u(3), motivo: 'error' })).rejects.toThrow('sólo tiene');
    await expect(m.negocio.quitarDeCuenta({ cuentaId: c.id, productoId: m.cafe, cantidad: u(1), motivo: 'error' })).rejects.toThrow('no tiene');
    await expect(m.negocio.liberarMesa(c.id)).rejects.toThrow('tiene pedidos');
    await m.negocio.quitarDeCuenta({ cuentaId: c.id, productoId: m.cerveza, cantidad: u(2), motivo: 'Se equivocó de mesa' });
    expect(cuenta(m, mesa1).lineas).toEqual([]);
    await expect(m.negocio.anularCuenta(c.id, 'x')).rejects.toThrow('está vacía');
    await expect(m.negocio.cobrarCuenta({ cuentaId: c.id, pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('vacía');
    await m.negocio.liberarMesa(c.id);
    expect(cuentaDeMesa(m.negocio.estado, mesa1)).toBeNull();
  });

  it('pedir la cuenta, cambiar de mesa y no ocupar una mesa ocupada', async () => {
    const { m, mesa1, mesa2, terraza } = await conMesas();
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cafe, cantidad: u(1) }]);
    await m.negocio.pedirEnMesa(mesa2, [{ productoId: m.cafe, cantidad: u(1) }]);
    const c = cuenta(m, mesa1);
    await m.negocio.marcarPrecuenta(c.id, true);
    expect(cuenta(m, mesa1).precuenta).toBe(true);
    await expect(m.negocio.marcarPrecuenta(c.id, true)).rejects.toThrow('ya pidió');
    await expect(m.negocio.trasladarCuenta(c.id, mesa2)).rejects.toThrow('ya tiene una cuenta abierta');
    await expect(m.negocio.abrirCuenta(mesa2)).rejects.toThrow('ya tiene una cuenta abierta');
    await m.negocio.trasladarCuenta(c.id, terraza);
    expect(cuentaDeMesa(m.negocio.estado, mesa1)).toBeNull();
    expect(cuenta(m, terraza).id).toBe(c.id);
    // Otra ronda: ya no espera la cuenta
    await m.negocio.pedirEnMesa(terraza, [{ productoId: m.cafe, cantidad: u(1) }]);
    expect(cuenta(m, terraza).precuenta).toBe(false);
  });

  it('no se cierra la caja con mesas abiertas ni se retira una mesa ocupada', async () => {
    const { m, mesa1 } = await conMesas();
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cafe, cantidad: u(1) }]);
    await expect(m.negocio.cerrarCaja({ contado: $(100000), confirmar: true })).rejects.toThrow('una mesa con la cuenta abierta');
    await expect(m.negocio.retirarMesa(mesa1)).rejects.toThrow('tiene la cuenta abierta');
    await m.negocio.anularCuenta(cuenta(m, mesa1).id, 'Se fueron sin pagar');
    expect(stockDe(m.negocio.estado, m.cafe)).toBe(u(10));
    await m.negocio.retirarMesa(mesa1);
    expect(m.negocio.estado.mesas[mesa1]?.activa).toBe(false);
    await m.negocio.cerrarCaja({ contado: $(100000), confirmar: true, nota: 'prueba' });
    expect(m.negocio.estado.caja).toBeNull();
  });

  it('el mesero pide en las mesas pero no cobra, no quita ni anula', async () => {
    const { m, mesa1 } = await conMesas();
    expect(puede('mesero', 'cuenta.atender')).toBe(true);
    expect(puede('mesero', 'venta.registrar')).toBe(false);
    expect(puede('mesero', 'inventario.ver')).toBe(false);
    await entrarComo(m, 'Ana', 'mesero');
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cerveza, cantidad: u(1) }]);
    const c = cuenta(m, mesa1);
    await m.negocio.marcarPrecuenta(c.id, true);
    await expect(m.negocio.cobrarCuenta({ cuentaId: c.id, pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('Mesero');
    await expect(m.negocio.quitarDeCuenta({ cuentaId: c.id, productoId: m.cerveza, cantidad: u(1), motivo: 'x' })).rejects.toThrow('quitar productos');
    await expect(m.negocio.anularCuenta(c.id, 'x')).rejects.toThrow('anular cuentas');
    await expect(m.negocio.crearMesa({ nombre: 'Nueva', zona: 'Salón' })).rejects.toThrow('crear o retirar mesas');
    await volverADueno(m);
    await m.negocio.cobrarCuenta({ cuentaId: c.id, pagos: [{ forma: 'efectivo' }] });
  });

  it('las cuentas abiertas sobreviven a cerrar y volver a abrir la app', async () => {
    const { m, mesa1 } = await conMesas();
    await m.negocio.pedirEnMesa(mesa1, [{ productoId: m.cerveza, cantidad: u(2) }], { nota: 'Sin hielo' });
    const otra = await abrir(m.almacen, m.reloj);
    expect(cuentaDeMesa(otra.estado, mesa1)?.lineas).toEqual([{ productoId: m.cerveza, cantidad: u(2) }]);
    expect((await otra.iniciarSesion(m.dueno.id, '1234')).ok).toBe(true);
    expect((await otra.verificar()).ok).toBe(true);
  });
});
