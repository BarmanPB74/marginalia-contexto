import { describe, expect, it } from 'vitest';
import { act } from 'preact/test-utils';
import { centavos, cuentaDeMesa, nombreDe, type Negocio } from '../../src/core/negocio';
import { diaDe } from '../../src/core/notas/fechas';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { PantallaMesas } from '../../src/features/mesas/PantallaMesas';
import { leerHora, PantallaReservas } from '../../src/features/reservas/PantallaReservas';
import { boton, esperar, hastaQue, montar, negocioDePrueba, repoNuevo } from './ayuda';

async function tocar(b: HTMLElement) {
  await act(async () => b.click());
  await esperar();
}

async function escribir(c: ParentNode, etiqueta: string, valor: string) {
  const label = [...c.querySelectorAll('label')].find((l) => l.textContent?.trim() === etiqueta);
  const input = label && (c.querySelector(`#${CSS.escape(label.htmlFor)}`) as HTMLInputElement | null);
  if (!input) throw new Error(`No hay campo «${etiqueta}»`);
  await act(async () => {
    input.value = valor;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await esperar();
}

function ver(negocio: Negocio, vista: 'reservas' | 'mesas', hash: string) {
  location.hash = hash;
  return montar(<ProveedorNegocio>{vista === 'reservas' ? <PantallaReservas /> : <PantallaMesas />}</ProveedorNegocio>, repoNuevo(), negocio);
}

const texto = (c: HTMLElement) => c.textContent ?? '';

describe('leerHora', () => {
  it('entiende 20, 20:30, 2030, 8 pm y 8:15 p. m.', () => {
    expect(leerHora('20')).toBe('20:00');
    expect(leerHora('20:30')).toBe('20:30');
    expect(leerHora('2030')).toBe('20:30');
    expect(leerHora('8 pm')).toBe('20:00');
    expect(leerHora('8:15 p. m.')).toBe('20:15');
    expect(leerHora('12 am')).toBe('00:00');
    expect(() => leerHora('25:00')).toThrow();
    expect(() => leerHora('mañana')).toThrow();
  });
});

describe('Reservas: pantalla', () => {
  it('crear una reserva exige avisar al cliente el tiempo de espera y lo recuerda', async () => {
    const negocio = await negocioDePrueba();
    const c = await ver(negocio, 'reservas', '#/reservas');
    expect(texto(c)).toContain('No hay reservas para hoy');
    await tocar(boton(c, 'Nueva reserva'));
    await escribir(c, 'Nombre', 'Familia Ruiz');
    await escribir(c, 'Hora', '23:30');
    await escribir(c, 'Personas', '6');
    await tocar(boton(c, '20 min'));
    expect(c.querySelector('.reservas__recordatorio')?.textContent).toContain('Si no llega a las 23:50 (20 min después de las 23:30)');
    await tocar(boton(c, 'Guardar reserva'));
    expect(c.querySelector('[role=alert]')?.textContent).toContain('Avísale al cliente');
    const casilla = [...c.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find((x) => x.closest('label')?.textContent?.includes('Ya le avisé'));
    if (!casilla) throw new Error('sin casilla');
    await tocar(casilla);
    await tocar(boton(c, 'Guardar reserva'));
    await hastaQue(() => Object.keys(negocio.estado.reservas).length === 1);
    const [r] = Object.values(negocio.estado.reservas);
    expect(r).toMatchObject({ fecha: diaDe(new Date()), hora: '23:30', personas: 6, tolerancia: 20 });
    expect(r && nombreDe(negocio.estado, r.cliente)).toBe('Familia Ruiz');
    await hastaQue(() => texto(c).includes('Familia Ruiz'));
    expect(c.querySelector('.reserva')?.textContent).toContain('Cancelable desde las 23:50');
  });

  it('contestó, se demora, y llegó sentándola en su mesa', async () => {
    const negocio = await negocioDePrueba();
    await negocio.abrirCaja(centavos(0));
    const mesa = (await negocio.crearMesa({ nombre: 'Mesa 9', zona: 'Salón' })).id;
    const ana = (await negocio.crearCliente({ nombre: 'Ana', telefono: '300' })).id;
    await negocio.crearReserva({ cliente: { tipo: 'cliente', clienteId: ana }, fecha: diaDe(new Date()), hora: '23:59', personas: 2, mesaId: mesa, tolerancia: 15, avisado: true });
    const c = await ver(negocio, 'reservas', '#/reservas');
    await tocar(boton(c, 'Contestó'));
    await hastaQue(() => texto(c).includes('Contestó') && c.querySelector('.insignia--info') !== null);
    await tocar(boton(c, 'Se demora'));
    await tocar(boton(c, '15 min'));
    await hastaQue(() => Object.values(negocio.estado.reservas)[0]?.demora === 15);
    await tocar(boton(c, 'Llegó'));
    await tocar(boton(c, /Mesa 9/));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa) !== null);
    expect(cuentaDeMesa(negocio.estado, mesa)?.cliente).toEqual({ tipo: 'cliente', clienteId: ana });
    expect(Object.values(negocio.estado.reservas)[0]?.estado).toBe('llego');
  });
});

describe('Mesas: nombre de momento', () => {
  it('le pone a la mesa un nombre escrito y el mapa lo muestra', async () => {
    const negocio = await negocioDePrueba();
    await negocio.abrirCaja(centavos(0));
    const mesa = (await negocio.crearMesa({ nombre: 'Mesa 1', zona: 'Salón' })).id;
    const c = await ver(negocio, 'mesas', `#/mesas?mesa=${mesa}`);
    await tocar(boton(c, 'Nombre de la mesa'));
    await escribir(c, 'Nombre', 'Cumpleaños de Leo');
    await tocar(boton(c, 'Abrir mesa con este nombre'));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa)?.cliente !== undefined && cuentaDeMesa(negocio.estado, mesa) !== null);
    await hastaQue(() => c.querySelector('h1')?.textContent === 'Cumpleaños de Leo');
    // Quitar el nombre: vuelve a «Mesa 1»
    await tocar(boton(c, 'Cambiar nombre'));
    await tocar(boton(c, 'Sin nombre'));
    await tocar(boton(c, 'Guardar'));
    await hastaQue(() => cuentaDeMesa(negocio.estado, mesa)?.cliente === null);
    await hastaQue(() => c.querySelector('h1')?.textContent === 'Mesa 1');
  });
});
