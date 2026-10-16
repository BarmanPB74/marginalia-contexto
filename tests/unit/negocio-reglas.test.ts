import { describe, expect, it } from 'vitest';
import {
  alertas,
  centavos,
  estadoVacio,
  milesimas,
  proyectar,
  ReglaRota,
  stockDe,
  validar,
  type Evento,
} from '../../src/core/negocio';
import { planImportacion } from '../../src/core/negocio/importar';
import { $, entrarComo, montar, u, volverADueno, type Montaje } from './negocio-ayuda';

async function conStock(m: Montaje) {
  await m.negocio.ajustarInventario({ productoId: m.cerveza, delta: u(24), motivo: 'correccion' });
  await m.negocio.ajustarInventario({ productoId: m.queso, delta: u(5), motivo: 'correccion' });
  await m.negocio.ajustarInventario({ productoId: m.cafe, delta: u(50), motivo: 'correccion' });
}

describe('primer uso y usuarios', () => {
  it('el primer usuario es dueño aunque pidan otro cargo, y queda con sesión', async () => {
    const m = await montar();
    expect(m.negocio.primerUso).toBe(false);
    expect(m.negocio.sesion?.rol).toBe('dueno');
    expect(m.dueno.por).toBe(m.dueno.id);
  });

  it('no se puede quedar sin dueño ni repetir nombre', async () => {
    const m = await montar();
    await expect(m.negocio.desactivarUsuario(m.dueno.id)).rejects.toThrow('único dueño');
    await expect(m.negocio.crearUsuario({ nombre: 'pablo', rol: 'cajero', pin: '1111' })).rejects.toThrow('Ya hay un usuario');
  });

  it('cambiar el PIN propio exige el actual', async () => {
    const m = await montar();
    await expect(m.negocio.cambiarPin(m.dueno.id, '9999', '0000')).rejects.toThrow('PIN actual');
    await m.negocio.cambiarPin(m.dueno.id, '9999', '1234');
    m.negocio.cerrarSesion();
    expect((await m.negocio.iniciarSesion(m.dueno.id, '1234')).ok).toBe(false);
    expect((await m.negocio.iniciarSesion(m.dueno.id, '9999')).ok).toBe(true);
  });
});

describe('caja en pasos', () => {
  it('sin caja no se vende; dos cajas abiertas no', async () => {
    const m = await montar();
    await conStock(m);
    await expect(m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('Abre la caja');
    await m.negocio.abrirCaja($(50000));
    await expect(m.negocio.abrirCaja($(1))).rejects.toThrow('Ya hay una caja abierta');
  });

  it('cuadre exacto: base + efectivo + ingresos − retiros − gastos y pagos de caja', async () => {
    const m = await montar();
    await conStock(m);
    await m.negocio.abrirCaja($(100000));
    // 2 cervezas en efectivo ($ 17.000) con billete de $ 20.000.
    const v1 = await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(2) }], pagos: [{ forma: 'efectivo' }], recibido: $(20000) });
    expect(v1.tipo === 'venta.registrada' && v1.datos.cambio).toBe(300000);
    // 3 cafés: $ 5.000 en efectivo y el resto por Nequi (transferencia).
    await m.negocio.vender({ lineas: [{ productoId: m.cafe, cantidad: u(3) }], pagos: [{ forma: 'efectivo', monto: $(5000) }, { forma: 'transferencia' }] });
    // Con tarjeta: no entra al cajón.
    await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(1) }], pagos: [{ forma: 'tarjeta' }] });
    await m.negocio.movimientoCaja({ tipo: 'ingreso', monto: $(20000), motivo: 'Sencillo' });
    await m.negocio.movimientoCaja({ tipo: 'retiro', monto: $(30000), motivo: 'Consignación' });
    await m.negocio.registrarGasto({ categoria: 'Aseo', descripcion: 'Jabón', monto: $(7000), forma: 'efectivo', deCaja: true });
    const compra = await m.negocio.registrarCompra({ proveedor: 'Distri', numero: 'F-1', fecha: '2026-10-16', lineas: [{ productoId: m.cerveza, cantidad: u(6), costoUnit: $(3000) }] });
    await m.negocio.pagarFactura({ compraId: compra.id, monto: $(10000), forma: 'efectivo', deCaja: true });

    const r = m.negocio.resumenCierre($(95000));
    // 100.000 + 22.000 + 20.000 − 30.000 − 7.000 − 10.000 = 95.000
    expect(r?.esperado).toBe($(95000));
    expect(r?.diferencia).toBe(0);
    expect(r?.ventasPorForma).toEqual({ efectivo: $(22000), tarjeta: $(8500), transferencia: $(7000), cortesia: 0 });
    expect(r?.vendido).toBe($(37500));

    await expect(m.negocio.cerrarCaja({ contado: $(94000), confirmar: false })).rejects.toThrow('confírmalo');
    await expect(m.negocio.cerrarCaja({ contado: $(94000), confirmar: true, esperadoVisto: $(90000) })).rejects.toThrow('cambió');
    const cierre = await m.negocio.cerrarCaja({ contado: $(94000), confirmar: true, esperadoVisto: r?.esperado ?? centavos(0) });
    // La diferencia se guarda tal cual, sin corregirse sola.
    expect(cierre.tipo === 'caja.cerrada' && cierre.datos.diferencia).toBe(-$(1000));
    expect(m.negocio.estado.caja).toBeNull();
    expect(m.negocio.estado.cierres[0]?.diferencia).toBe(-$(1000));
  });

  it('no se retira más de lo que hay; caja sin movimientos sólo cierra con motivo', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(10000));
    await expect(m.negocio.movimientoCaja({ tipo: 'retiro', monto: $(10001), motivo: 'x' })).rejects.toThrow('No puedes retirar');
    await expect(m.negocio.registrarGasto({ categoria: 'Aseo', descripcion: 'x', monto: $(5), forma: 'tarjeta', deCaja: true })).rejects.toThrow('efectivo');
    expect(m.negocio.resumenCierre()?.sinMovimientos).toBe(true);
    await expect(m.negocio.cerrarCaja({ contado: $(10000), confirmar: true })).rejects.toThrow('motivo');
    await m.negocio.cerrarCaja({ contado: $(10000), confirmar: true, nota: 'La abrí por error' });
    expect(m.negocio.estado.cierres).toHaveLength(1);
  });
});

describe('ventas e inventario', () => {
  it('una venta descuenta varios productos en UNA escritura; anularla los devuelve', async () => {
    const m = await montar();
    await conStock(m);
    await m.negocio.abrirCaja($(0));
    let avisos = 0;
    const quitar = m.negocio.suscribir(() => avisos++);
    const v = await m.negocio.vender({
      lineas: [
        { productoId: m.cerveza, cantidad: u(2) },
        { productoId: m.queso, cantidad: u(0.25) },
        { productoId: m.cafe, cantidad: u(1) },
        { productoId: m.cerveza, cantidad: u(1) }, // repetida: se suma
      ],
      descuento: { tipo: 'porcentaje', valor: 10 },
      pagos: [{ forma: 'efectivo' }],
    });
    quitar();
    expect(avisos).toBe(1);
    const e = m.negocio.estado;
    expect(stockDe(e, m.cerveza)).toBe(u(21));
    expect(stockDe(e, m.queso)).toBe(u(4.75));
    expect(stockDe(e, m.cafe)).toBe(u(49));
    if (v.tipo !== 'venta.registrada') throw new Error('tipo');
    // 3 × 8.500 + 0,25 × 40.000 + 4.000 = 39.500; 10 % = 3.950 → total 35.550
    expect(v.datos.lineas).toHaveLength(3);
    expect(v.datos.descuento?.monto).toBe($(3950));
    expect(v.datos.total).toBe($(35550));
    expect(e.eventos).toBe(m.negocio.estado.eventos);

    await m.negocio.anularVenta(v.id, 'Cliente se arrepintió');
    expect(stockDe(m.negocio.estado, m.cerveza)).toBe(u(24));
    expect(stockDe(m.negocio.estado, m.queso)).toBe(u(5));
    expect(m.negocio.resumenCierre()?.esperado).toBe(0);
    await expect(m.negocio.anularVenta(v.id, 'otra vez')).rejects.toThrow('ya está anulada');
  });

  it('no se anula una venta de una caja cerrada', async () => {
    const m = await montar();
    await conStock(m);
    await m.negocio.abrirCaja($(0));
    const v = await m.negocio.vender({ lineas: [{ productoId: m.cafe, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] });
    await m.negocio.cerrarCaja({ contado: $(4000), confirmar: true });
    await m.negocio.abrirCaja($(0));
    await expect(m.negocio.anularVenta(v.id, 'tarde')).rejects.toThrow('caja ya cerrada');
  });

  it('el stock puede quedar negativo y sale en alertas, igual que lo bajo del mínimo', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(0));
    await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(2) }], pagos: [{ forma: 'tarjeta' }] });
    const a = alertas(m.negocio.estado);
    expect(a[0]).toMatchObject({ productoId: m.cerveza, tipo: 'negativo', stock: -2000 });
    expect(a.find((x) => x.productoId === m.queso)?.tipo).toBe('bajoMinimo');
  });

  it('la venta no confía en la pantalla: precios, subtotales y pagos se comprueban', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(0));
    const caja = m.negocio.estado.caja?.id ?? '';
    const linea = { productoId: m.cerveza, nombre: 'Cerveza', cantidad: u(1), precioUnit: $(1), subtotal: $(1) };
    await expect(
      m.negocio.ejecutar({ tipo: 'venta.registrada', datos: { cajaId: caja, lineas: [linea], total: $(1), pagos: [{ forma: 'efectivo', monto: $(1) }] } }),
    ).rejects.toThrow('cambió');
    await expect(
      m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(1) }], pagos: [{ forma: 'efectivo', monto: $(1000) }] }),
    ).rejects.toThrow('no suman');
    await expect(m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(0.5) }], pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('unidades enteras');
    await expect(
      m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }], recibido: $(5000) }),
    ).rejects.toThrow('menos que el efectivo');
  });

  it('conteo: deja la existencia contada y guarda antes y después', async () => {
    const m = await montar();
    await conStock(m);
    const e = await m.negocio.contar(m.cerveza, u(20), { nota: 'Cierre de mes' });
    expect(e.tipo === 'inventario.ajuste' && e.datos).toMatchObject({ delta: -4000, antes: 24000, despues: 20000, motivo: 'conteo' });
    expect(stockDe(m.negocio.estado, m.cerveza)).toBe(u(20));
    await expect(m.negocio.contar(m.cerveza, u(10), { antesVisto: u(24) })).rejects.toThrow('Vuelve a contar');
    await expect(m.negocio.contar(m.cerveza, milesimas(-1))).rejects.toThrow('negativo');
  });
});

describe('compras y pagos', () => {
  it('la factura entra al inventario una sola vez y fija el último costo', async () => {
    const m = await montar();
    await entrarComo(m, 'Beto', 'bodega');
    const c = await m.negocio.registrarCompra({
      proveedor: 'Lácteos SAS',
      numero: 'A-77',
      fecha: '2026-10-15',
      vence: '2026-11-15',
      lineas: [
        { productoId: m.queso, cantidad: u(2.5), costoUnit: $(22000) },
        { productoId: m.cerveza, cantidad: u(24), costoUnit: $(3100) },
      ],
      adjuntos: ['foto-factura-a77.jpg'],
    });
    expect(c.tipo === 'compra.registrada' && c.datos.total).toBe($(55000 + 74400));
    expect(stockDe(m.negocio.estado, m.queso)).toBe(0); // registrar no toca el stock
    await m.negocio.aplicarCompra(c.id);
    expect(stockDe(m.negocio.estado, m.queso)).toBe(u(2.5));
    expect(m.negocio.estado.productos[m.cerveza]?.costo).toBe($(3100));
    await expect(m.negocio.aplicarCompra(c.id)).rejects.toThrow('no se suma dos veces');
    expect(stockDe(m.negocio.estado, m.cerveza)).toBe(u(24));
    await expect(
      m.negocio.registrarCompra({ proveedor: 'lácteos sas', numero: 'a-77', fecha: '2026-10-15', lineas: [{ productoId: m.queso, cantidad: u(1), costoUnit: $(1) }] }),
    ).rejects.toThrow('ya está registrada');
  });

  it('pagos parciales bajan el saldo; no se paga de más; anular sólo sin aplicar ni pagos', async () => {
    const m = await montar();
    const c = await m.negocio.registrarCompra({ proveedor: 'Distri', numero: '9', fecha: '2026-10-16', lineas: [{ productoId: m.cafe, cantidad: u(10), costoUnit: $(1000) }] });
    await m.negocio.pagarFactura({ compraId: c.id, monto: $(4000), forma: 'transferencia', deCaja: false });
    expect(m.negocio.estado.compras[c.id]).toMatchObject({ pagado: $(4000), saldo: $(6000) });
    await expect(m.negocio.pagarFactura({ compraId: c.id, monto: $(6001), forma: 'tarjeta', deCaja: false })).rejects.toThrow('mayor que el saldo');
    await expect(m.negocio.pagarFactura({ compraId: c.id, monto: $(100), forma: 'efectivo', deCaja: true })).rejects.toThrow('No hay caja abierta');
    await expect(m.negocio.anularCompra(c.id, 'error')).rejects.toThrow('ya tiene pagos');
    await m.negocio.pagarFactura({ compraId: c.id, monto: $(6000), forma: 'efectivo', deCaja: false });
    expect(m.negocio.estado.compras[c.id]?.saldo).toBe(0);
    await expect(m.negocio.pagarFactura({ compraId: c.id, monto: $(1), forma: 'efectivo', deCaja: false })).rejects.toThrow('ya está pagada');

    const otra = await m.negocio.registrarCompra({ proveedor: 'Distri', numero: '10', fecha: '2026-10-16', lineas: [{ productoId: m.cafe, cantidad: u(1), costoUnit: $(1) }] });
    await m.negocio.anularCompra(otra.id, 'Duplicada');
    await expect(m.negocio.aplicarCompra(otra.id)).rejects.toThrow('anulada');
  });

  it('gastos: anular uno de la caja abierta devuelve la plata al esperado', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(50000));
    const g = await m.negocio.registrarGasto({ categoria: 'Hielo', descripcion: '2 bolsas', monto: $(8000), forma: 'efectivo', deCaja: true });
    expect(m.negocio.resumenCierre()?.esperado).toBe($(42000));
    await m.negocio.anularGasto(g.id, 'Lo pagó el proveedor');
    expect(m.negocio.resumenCierre()?.esperado).toBe($(50000));
  });
});

describe('entradas hostiles', () => {
  it('textos larguísimos, claves extra y números no enteros se rechazan', async () => {
    const m = await montar();
    await expect(m.negocio.crearProducto({ nombre: 'x'.repeat(81), categoria: 'A', unidad: 'unidad', precio: $(1) })).rejects.toThrow('máximo 80');
    await expect(
      m.negocio.ejecutar({ tipo: 'caja.abierta', datos: { base: 1.5 as never } }),
    ).rejects.toThrow('entero');
    await expect(
      m.negocio.ejecutar({ tipo: 'caja.abierta', datos: { base: $(1), extra: 1 } as never }),
    ).rejects.toThrow('desconocido');
    await expect(m.negocio.crearProducto({ nombre: 'Malo\u0000', categoria: 'A', unidad: 'unidad', precio: $(1) })).rejects.toThrow('control');
  });

  it('validar() puro: evento de un desconocido', () => {
    const e = { id: '01J0000000000000000000000A', tipo: 'caja.abierta', en: '2026-10-16T10:00:00-05:00', por: '01J0000000000000000000000B', datos: { base: 0 } } as Evento;
    const conDueno = proyectar([
      { id: '01J0000000000000000000000C', tipo: 'usuario.creado', en: e.en, por: '01J0000000000000000000000C', datos: { nombre: 'D', rol: 'dueno', pin: { sal: 'AA==', hash: 'AA==', iteraciones: 1 } } } as Evento,
    ]);
    expect(() => validar(conDueno, e)).toThrow(ReglaRota);
    expect(() => validar(estadoVacio(), e)).toThrow(ReglaRota);
  });
});

describe('operaciones atómicas e importación', () => {
  it('ejecutarVarios: si un comando falla no se guarda ninguno', async () => {
    const m = await montar();
    const antes = m.negocio.estado.eventos;
    await expect(
      m.negocio.ejecutarVarios(() => [
        { tipo: 'inventario.ajuste', datos: { productoId: m.cafe, delta: u(5), motivo: 'correccion' } },
        { tipo: 'caja.movimiento', datos: { tipo: 'ingreso', monto: $(1), motivo: 'sin caja' } },
      ]),
    ).rejects.toThrow('No hay caja abierta');
    expect(m.negocio.estado.eventos).toBe(antes);
    expect(stockDe(m.negocio.estado, m.cafe)).toBe(0);
  });

  it('importarInventario crea, ajusta (también a negativo) y sigue pese a errores', async () => {
    const m = await montar();
    await conStock(m);
    const existentes = Object.values(m.negocio.estado.productos).map((p) => ({ id: p.id, nombre: p.nombre, cantidad: stockDe(m.negocio.estado, p.id) }));
    const plan = planImportacion(
      existentes,
      [
        { nombre: 'CERVEZA', cantidad: milesimas(-3000), filaOriginal: 2 },
        { nombre: 'Café', cantidad: milesimas(50000), filaOriginal: 3 },
        { nombre: 'Aguardiente', cantidad: milesimas(12000), precio: $(60000), unidad: 'und', categoria: 'Licores', filaOriginal: 4 },
        { nombre: 'Agua', cantidad: milesimas(0), unidad: 'lt', filaOriginal: 5 },
      ],
      'fijar',
    );
    plan.push({ tipo: 'crear', fila: { nombre: 'Queso', cantidad: milesimas(1000), filaOriginal: 6 } }); // repetido: error
    const r = await m.negocio.importarInventario(plan);
    expect(r).toMatchObject({ creados: 2, ajustados: 1, sinCambio: 1 });
    expect(r.errores).toEqual([{ fila: 6, nombre: 'Queso', motivo: expect.stringContaining('Ya existe') }]);
    expect(stockDe(m.negocio.estado, m.cerveza)).toBe(-3000);
    const aguardiente = Object.values(m.negocio.estado.productos).find((p) => p.nombre === 'Aguardiente');
    expect(aguardiente).toMatchObject({ unidad: 'unidad', categoria: 'Licores', precio: $(60000) });
    expect(stockDe(m.negocio.estado, aguardiente?.id ?? '')).toBe(12000);
    expect(Object.values(m.negocio.estado.productos).find((p) => p.nombre === 'Agua')?.unidad).toBe('L');
  });

  it('bodega importa ajustes pero no crea productos (fijan precio)', async () => {
    const m = await montar();
    await entrarComo(m, 'Beto', 'bodega');
    const r = await m.negocio.importarInventario([
      { tipo: 'crear', fila: { nombre: 'Nuevo', cantidad: milesimas(1000), filaOriginal: 2 } },
      { tipo: 'ajustar', modo: 'sumar', delta: milesimas(6000), productoId: m.cafe, nombre: 'Café', fila: { nombre: 'Café', cantidad: milesimas(6000), filaOriginal: 3 } },
    ]);
    expect(r.creados).toBe(0);
    expect(r.ajustados).toBe(1);
    expect(r.errores[0]?.motivo).toContain('crear productos');
    await volverADueno(m);
  });
});
