import { describe, expect, it } from 'vitest';
import { alertas, cuentaDeMesa, nombreDe, puede, situacionReserva, stockDe } from '../../src/core/negocio';
import { $, abrir, entrarComo, montar, u, volverADueno } from './negocio-ayuda';

describe('producto descontinuado', () => {
  it('no da alertas, no se vende ni se pide, y se puede reactivar', async () => {
    const m = await montar();
    await m.negocio.ajustarInventario({ productoId: m.queso, delta: u(-2), motivo: 'correccion' });
    expect(alertas(m.negocio.estado).map((a) => a.productoId)).toContain(m.queso);
    await m.negocio.descontinuarProducto(m.queso, true);
    expect(m.negocio.estado.productos[m.queso]?.descontinuado).toBe(true);
    expect(alertas(m.negocio.estado).map((a) => a.productoId)).not.toContain(m.queso);
    await expect(m.negocio.descontinuarProducto(m.queso, true)).rejects.toThrow('ya está descontinuado');
    await m.negocio.abrirCaja($(0));
    await expect(m.negocio.vender({ lineas: [{ productoId: m.queso, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('descontinuado');
    const mesa = (await m.negocio.crearMesa({ nombre: 'Mesa 1', zona: 'Salón' })).id;
    await expect(m.negocio.pedirEnMesa(mesa, [{ productoId: m.queso, cantidad: u(1) }])).rejects.toThrow('descontinuado');
    // Editar no lo reactiva; reactivar sí
    await m.negocio.editarProducto(m.queso, { nombre: 'Queso viejo' });
    expect(m.negocio.estado.productos[m.queso]?.descontinuado).toBe(true);
    await m.negocio.descontinuarProducto(m.queso, false);
    expect(m.negocio.estado.productos[m.queso]?.descontinuado).toBeUndefined();
  });
});

describe('copas y conteo por grupo', () => {
  it('guarda las copas por botella y cuenta varios productos en una sola escritura', async () => {
    const m = await montar();
    const ron = (await m.negocio.crearProducto({ nombre: 'Ron', categoria: 'Licores', unidad: 'unidad', precio: $(90000), copas: 20 })).id;
    expect(m.negocio.estado.productos[ron]?.copas).toBe(20);
    await m.negocio.editarProducto(ron, { copas: 25 });
    expect(m.negocio.estado.productos[ron]?.copas).toBe(25);
    // 3 botellas y 5 copas de 25 = 3,2 botellas
    const evs = await m.negocio.contarVarios([
      { productoId: ron, contado: u(3.2) },
      { productoId: m.cafe, contado: u(12) },
    ], 'Conteo del lunes');
    expect(evs).toHaveLength(2);
    expect(stockDe(m.negocio.estado, ron)).toBe(u(3.2));
    expect(stockDe(m.negocio.estado, m.cafe)).toBe(u(12));
    await expect(m.negocio.contarVarios([{ productoId: m.cafe, contado: u(1), antesVisto: u(5) }])).rejects.toThrow('cambió mientras contabas');
    expect(stockDe(m.negocio.estado, m.cafe)).toBe(u(12));
  });

  it('los productos de antes (sin copas) se siguen leyendo del diario', async () => {
    const m = await montar();
    const otra = await abrir(m.almacen, m.reloj);
    expect(otra.estado.productos[m.cerveza]?.copas).toBeUndefined();
  });
});

describe('clientes y nombre de la mesa', () => {
  it('pone a la mesa el nombre de un cliente, de alguien del equipo o uno de momento, y lo quita', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(0));
    const mesa = (await m.negocio.crearMesa({ nombre: 'Mesa 2', zona: 'Salón' })).id;
    const ana = (await m.negocio.crearCliente({ nombre: 'Ana Gómez', telefono: '3001234567' })).id;
    await expect(m.negocio.crearCliente({ nombre: 'ana gómez', telefono: '3001234567' })).rejects.toThrow('ya está registrado');

    // Mesa libre: ponerle nombre la abre
    await m.negocio.nombrarMesa(mesa, { tipo: 'cliente', clienteId: ana });
    const nombreMesa = () => {
      const ref = cuentaDeMesa(m.negocio.estado, mesa)?.cliente;
      return ref ? nombreDe(m.negocio.estado, ref) : null;
    };
    expect(nombreMesa()).toBe('Ana Gómez');
    await m.negocio.nombrarMesa(mesa, { tipo: 'usuario', usuarioId: m.dueno.id });
    expect(nombreMesa()).toBe('Pablo');
    await m.negocio.nombrarMesa(mesa, { tipo: 'nombre', nombre: '  Cumpleaños de Leo  ' });
    expect(cuentaDeMesa(m.negocio.estado, mesa)?.cliente).toEqual({ tipo: 'nombre', nombre: 'Cumpleaños de Leo' });
    await m.negocio.nombrarMesa(mesa, null);
    expect(cuentaDeMesa(m.negocio.estado, mesa)?.cliente).toBeNull();
    await expect(m.negocio.nombrarMesa(mesa, { tipo: 'cliente', clienteId: m.cafe })).rejects.toThrow('no está registrado');
  });
});

describe('reservas', () => {
  const hoy = '2026-10-16';

  it('exige avisar al cliente el tiempo de espera y no deja dos reservas encima en la misma mesa', async () => {
    const m = await montar();
    const mesa = (await m.negocio.crearMesa({ nombre: 'Mesa 5', zona: 'Terraza' })).id;
    const base = { cliente: { tipo: 'nombre', nombre: 'Familia Ruiz' } as const, fecha: hoy, hora: '20:00', personas: 6, mesaId: mesa, tolerancia: 15 };
    await expect(m.negocio.crearReserva({ ...base, avisado: false })).rejects.toThrow('Avísale al cliente');
    await m.negocio.crearReserva({ ...base, avisado: true, telefono: '3110000000' });
    await expect(m.negocio.crearReserva({ ...base, hora: '21:00', avisado: true })).rejects.toThrow('ya tiene una reserva a las 20:00');
    await m.negocio.crearReserva({ ...base, hora: '22:30', avisado: true });
    await expect(m.negocio.crearReserva({ ...base, fecha: '2026-10-15', hora: '23:00', avisado: true })).rejects.toThrow('ya pasó');
    expect(Object.values(m.negocio.estado.reservas)).toHaveLength(2);
  });

  it('a tiempo → esperando → en tiempo de cancelación, corriendo con la demora avisada', async () => {
    const m = await montar();
    const r = (await m.negocio.crearReserva({ cliente: { tipo: 'nombre', nombre: 'Leo' }, fecha: hoy, hora: '20:00', personas: 2, tolerancia: 15, avisado: true })).id;
    const res = () => {
      const x = m.negocio.estado.reservas[r];
      if (!x) throw new Error('sin reserva');
      return x;
    };
    expect(situacionReserva(res(), new Date(2026, 9, 16, 19, 59))).toBe('aTiempo');
    expect(situacionReserva(res(), new Date(2026, 9, 16, 20, 10))).toBe('esperando');
    expect(situacionReserva(res(), new Date(2026, 9, 16, 20, 15))).toBe('cancelable');
    await m.negocio.llamadaReserva(r, false);
    await m.negocio.llamadaReserva(r, true);
    expect(res().llamada?.contesto).toBe(true);
    expect(res().llamadas).toBe(2);
    await m.negocio.demoraReserva(r, 20);
    expect(situacionReserva(res(), new Date(2026, 9, 16, 20, 15))).toBe('aTiempo');
    expect(situacionReserva(res(), new Date(2026, 9, 16, 20, 30))).toBe('esperando');
    await m.negocio.noLlegoReserva(r);
    expect(res().estado).toBe('noLlego');
    await expect(m.negocio.llamadaReserva(r, true)).rejects.toThrow('ya se cerró');
  });

  it('llegó: la sientan en su mesa con el nombre de la reserva', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(0));
    const mesa = (await m.negocio.crearMesa({ nombre: 'Mesa 7', zona: 'Salón' })).id;
    const ana = (await m.negocio.crearCliente({ nombre: 'Ana' })).id;
    const r = (await m.negocio.crearReserva({ cliente: { tipo: 'cliente', clienteId: ana }, fecha: hoy, hora: '20:00', personas: 3, mesaId: mesa, tolerancia: 10, avisado: true })).id;
    const evs = await m.negocio.llegoReserva(r, { mesaId: mesa });
    expect(evs.map((e) => e.tipo)).toEqual(['cuenta.abierta', 'reserva.llego']);
    const c = cuentaDeMesa(m.negocio.estado, mesa);
    expect(c?.cliente).toEqual({ tipo: 'cliente', clienteId: ana });
    expect(c?.personas).toBe(3);
    expect(m.negocio.estado.reservas[r]).toMatchObject({ estado: 'llego', cuentaId: c?.id });
    const otra = (await m.negocio.crearReserva({ cliente: { tipo: 'nombre', nombre: 'Leo' }, fecha: hoy, hora: '23:00', personas: 2, tolerancia: 10, avisado: true })).id;
    await m.negocio.cancelarReserva(otra, 'Llamó a cancelar');
    expect(m.negocio.estado.reservas[otra]?.motivo).toBe('Llamó a cancelar');
  });

  it('la recepcionista maneja reservas y clientes y sienta, pero no pide ni cobra', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(0));
    const mesa = (await m.negocio.crearMesa({ nombre: 'Mesa 1', zona: 'Salón' })).id;
    expect(puede('recepcionista', 'reserva.gestionar')).toBe(true);
    expect(puede('recepcionista', 'cuenta.atender')).toBe(false);
    expect(puede('mesero', 'reserva.gestionar')).toBe(false);
    await entrarComo(m, 'Sara', 'recepcionista');
    const cliente = (await m.negocio.crearCliente({ nombre: 'Juan' })).id;
    await m.negocio.nombrarMesa(mesa, { tipo: 'cliente', clienteId: cliente });
    await expect(m.negocio.pedirEnMesa(mesa, [{ productoId: m.cafe, cantidad: u(1) }])).rejects.toThrow('Recepcionista');
    await expect(m.negocio.vender({ lineas: [{ productoId: m.cafe, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] })).rejects.toThrow('Recepcionista');
    await volverADueno(m);
    await m.negocio.pedirEnMesa(mesa, [{ productoId: m.cafe, cantidad: u(1) }]);
  });

  it('las reservas cerradas de hace más de una semana salen del estado', async () => {
    const m = await montar();
    const r = (await m.negocio.crearReserva({ cliente: { tipo: 'nombre', nombre: 'Leo' }, fecha: hoy, hora: '20:00', personas: 2, tolerancia: 10, avisado: true })).id;
    await m.negocio.noLlegoReserva(r);
    m.reloj.avanzar(60 * 24 * 9);
    await m.negocio.crearReserva({ cliente: { tipo: 'nombre', nombre: 'Ana' }, fecha: '2026-10-25', hora: '20:00', personas: 2, tolerancia: 10, avisado: true });
    expect(m.negocio.estado.reservas[r]).toBeUndefined();
    expect(Object.keys(m.negocio.estado.reservas)).toHaveLength(1);
  });
});
