/** Ayudas compartidas por las pruebas `negocio-*`: un negocio en memoria con reloj fijo. */
import { crearAlmacen, DiscoMemoria, type Almacen } from '../../src/core/almacen/almacen';
import { centavos, milesimas, Negocio, type Evento } from '../../src/core/negocio';

export const $ = (pesos: number) => centavos(pesos * 100);
export const u = (unidades: number) => milesimas(Math.round(unidades * 1000));

/** Reloj controlable: empieza el 16 de octubre de 2026 a las 10:00 (hora local). */
export class Reloj {
  t = new Date(2026, 9, 16, 10, 0, 0).getTime();
  ahora = () => new Date(this.t);
  avanzar(minutos: number) {
    this.t += minutos * 60_000;
  }
}

export interface Montaje {
  disco: DiscoMemoria;
  almacen: Almacen;
  reloj: Reloj;
  negocio: Negocio;
  dueno: Evento;
  cerveza: string;
  queso: string;
  cafe: string;
}

export async function abrir(almacen: Almacen, reloj: Reloj): Promise<Negocio> {
  return Negocio.crear(almacen, { reloj: reloj.ahora, iteracionesPin: 1 });
}

/** Negocio con dueño (PIN 1234, sesión abierta) y tres productos sin stock. */
export async function montar(): Promise<Montaje> {
  const disco = new DiscoMemoria();
  const almacen = crearAlmacen(disco);
  const reloj = new Reloj();
  const negocio = await abrir(almacen, reloj);
  const dueno = await negocio.crearUsuario({ nombre: 'Pablo', rol: 'dueno', pin: '1234' });
  const cerveza = (await negocio.crearProducto({ nombre: 'Cerveza', categoria: 'Bebidas', unidad: 'unidad', precio: $(8500), costo: $(3000) })).id;
  const queso = (await negocio.crearProducto({ nombre: 'Queso', categoria: 'Cocina', unidad: 'kg', precio: $(40000), costo: null, stockMinimo: u(1) })).id;
  const cafe = (await negocio.crearProducto({ nombre: 'Café', categoria: 'Bebidas', unidad: 'unidad', precio: $(4000), costo: $(1000) })).id;
  return { disco, almacen, reloj, negocio, dueno, cerveza, queso, cafe };
}

/** Crea un usuario con el dueño y deja la sesión en ese usuario. */
export async function entrarComo(m: Montaje, nombre: string, rol: 'cajero' | 'bodega', pin = '5678'): Promise<string> {
  const ev = await m.negocio.crearUsuario({ nombre, rol, pin });
  const r = await m.negocio.iniciarSesion(ev.id, pin);
  if (!r.ok) throw new Error(r.mensaje);
  return ev.id;
}

export async function volverADueno(m: Montaje) {
  const r = await m.negocio.iniciarSesion(m.dueno.id, '1234');
  if (!r.ok) throw new Error(r.mensaje);
}
