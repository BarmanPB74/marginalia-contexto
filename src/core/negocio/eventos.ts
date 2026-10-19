/**
 * Eventos del diario de Stark.
 *
 * El negocio NO guarda «el inventario» ni «la caja»: guarda lo que pasó, en orden, en un
 * diario que sólo crece (append-only). El estado se calcula repitiendo los eventos
 * (`estado.ts`). Así cada operación —una venta que descuenta cinco productos— es UNA sola
 * escritura, y cualquier cifra se puede rastrear hasta el hecho que la produjo.
 *
 * Cada evento: `{ id, tipo, en, por, datos }`.
 * - `id`: ULID (se ordena por hora). Si el evento crea algo (producto, venta, compra, gasto,
 *   caja, usuario), ese algo se identifica con el `id` del evento que lo creó.
 * - `en`: fecha y hora local con desfase ('2026-10-16T21:05:00-05:00').
 * - `por`: id del usuario que lo hizo.
 *
 * `leerEvento()` valida la forma de un evento que viene de fuera (disco, pantalla) sin
 * confiar en nada: tipos, enteros seguros, longitudes de texto, claves desconocidas.
 * Las reglas de negocio (¿hay caja abierta?, ¿alcanza el saldo?) viven en `estado.ts`.
 */
import { esUlid, ulid } from '../notas/ulid';
import { isoConOffset } from '../notas/nota';
import type { Centavos, Milesimas } from './numeros';
import { MAX_CENTAVOS, MAX_MILESIMAS } from './numeros';
import {
  FORMAS_PAGO,
  LIMITES,
  MOTIVOS_AJUSTE,
  ROLES,
  UNIDADES,
  type FormaEgreso,
  type FormaPago,
  type MotivoAjuste,
  type PinGuardado,
  type RefCliente,
  type Rol,
  type Unidad,
} from './modelo';

/** Una regla del negocio impide la operación. El mensaje es para la persona, en español. */
export class ReglaRota extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ReglaRota';
  }
}

/** El evento no tiene la forma esperada (dato hostil, archivo dañado o error de programa). */
export class EventoInvalido extends ReglaRota {
  constructor(detalle: string) {
    super(`Dato inválido: ${detalle}`);
    this.name = 'EventoInvalido';
  }
}

// --- Datos de cada tipo -----------------------------------------------------

export interface LineaVenta {
  readonly productoId: string;
  /** Nombre en el momento de la venta (el producto puede cambiar de nombre después). */
  readonly nombre: string;
  readonly cantidad: Milesimas;
  readonly precioUnit: Centavos;
  readonly subtotal: Centavos;
}

export interface PagoVenta {
  readonly forma: FormaPago;
  readonly monto: Centavos;
}

export interface DescuentoAplicado {
  readonly tipo: 'porcentaje' | 'valor';
  /** Porcentaje entero (0–100) o centavos, según `tipo`. */
  readonly valor: number;
  /** Centavos descontados de verdad (ya redondeados). */
  readonly monto: Centavos;
}

export interface LineaCompra {
  readonly productoId: string;
  readonly cantidad: Milesimas;
  readonly costoUnit: Centavos;
}

/** Lo que se pide en una ronda: qué y cuánto. El precio se pone al cobrar (el vigente). */
export interface LineaCuenta {
  readonly productoId: string;
  readonly cantidad: Milesimas;
}

export interface DatosProducto {
  readonly nombre: string;
  readonly categoria: string;
  readonly unidad: Unidad;
  readonly precio: Centavos;
  readonly costo: Centavos | null;
  readonly stockMinimo: Milesimas | null;
  readonly codigo: string | null;
  /** Opcional (los productos de antes no lo traen): copas por unidad. */
  readonly copas?: number | null;
}

export interface Datos {
  'usuario.creado': { readonly nombre: string; readonly rol: Rol; readonly pin: PinGuardado };
  'usuario.pin': { readonly usuarioId: string; readonly pin: PinGuardado };
  'usuario.desactivado': { readonly usuarioId: string };
  'producto.creado': DatosProducto;
  'producto.editado': { readonly productoId: string; readonly cambios: Partial<DatosProducto> };
  'producto.archivado': { readonly productoId: string };
  'inventario.ajuste': {
    readonly productoId: string;
    readonly delta: Milesimas;
    readonly motivo: MotivoAjuste;
    readonly antes?: Milesimas;
    readonly despues?: Milesimas;
    readonly nota?: string;
  };
  'caja.abierta': { readonly base: Centavos };
  'caja.movimiento': { readonly tipo: 'ingreso' | 'retiro'; readonly monto: Centavos; readonly motivo: string };
  'caja.cerrada': {
    readonly cajaId: string;
    readonly contado: Centavos;
    readonly esperado: Centavos;
    /** contado − esperado, tal cual: un faltante es un hecho, no se maquilla. */
    readonly diferencia: Centavos;
    /** La persona vio el resumen y confirmó. Sin esto no se cierra. */
    readonly confirmado: boolean;
    readonly nota?: string;
  };
  'venta.registrada': {
    readonly cajaId: string;
    readonly lineas: readonly LineaVenta[];
    readonly descuento?: DescuentoAplicado;
    readonly total: Centavos;
    readonly pagos: readonly PagoVenta[];
    /** Efectivo que entregó el cliente (para calcular el cambio). */
    readonly recibido?: Centavos;
    readonly cambio?: Centavos;
    /** Cobro de la cuenta de una mesa: la cierra (las líneas son las de la cuenta). */
    readonly cuentaId?: string;
  };
  'venta.anulada': { readonly ventaId: string; readonly motivo: string };
  'compra.registrada': {
    readonly proveedor: string;
    readonly numero: string;
    /** Fecha de la factura, 'AAAA-MM-DD'. */
    readonly fecha: string;
    readonly vence?: string;
    readonly lineas: readonly LineaCompra[];
    readonly total: Centavos;
    /** Ids de archivos adjuntos (foto o PDF de la factura) en el almacén. */
    readonly adjuntos: readonly string[];
    readonly nota?: string;
  };
  'compra.aplicada': { readonly compraId: string };
  'compra.anulada': { readonly compraId: string; readonly motivo: string };
  'pago.factura': {
    readonly compraId: string;
    readonly monto: Centavos;
    readonly forma: FormaEgreso;
    /** Salió del cajón de la caja abierta (resta del esperado). */
    readonly deCaja: boolean;
  };
  'gasto.registrado': {
    readonly categoria: string;
    readonly descripcion: string;
    readonly monto: Centavos;
    readonly forma: FormaEgreso;
    readonly deCaja: boolean;
    readonly adjunto?: string;
  };
  'gasto.anulado': { readonly gastoId: string; readonly motivo: string };
  'mesa.creada': { readonly nombre: string; readonly zona: string };
  'mesa.retirada': { readonly mesaId: string };
  /** Se sienta gente: la mesa queda ocupada. Sin caja abierta no se abre cuenta. */
  'cuenta.abierta': { readonly mesaId: string; readonly personas?: number; readonly cliente?: RefCliente };
  /** Nombre de momento de la mesa (quién está): cliente, usuario, nombre o nada (`null`). */
  'cuenta.cliente': { readonly cuentaId: string; readonly cliente: RefCliente | null };
  /** Una ronda: lo que se pidió. No descuenta inventario (eso pasa al cobrar). */
  'cuenta.pedido': { readonly cuentaId: string; readonly lineas: readonly LineaCuenta[]; readonly nota?: string };
  /** Se retira algo pedido (error, no lo quisieron). Con motivo: queda a la vista. */
  'cuenta.quitado': { readonly cuentaId: string; readonly productoId: string; readonly cantidad: Milesimas; readonly motivo: string };
  'cuenta.precuenta': { readonly cuentaId: string; readonly pedida: boolean };
  'cuenta.trasladada': { readonly cuentaId: string; readonly mesaId: string };
  /** Cuenta sin nada pedido (se abrió por error o se fueron): la mesa queda libre. */
  'cuenta.liberada': { readonly cuentaId: string };
  /** Cuenta con pedidos que no se cobra (sólo el dueño, con motivo). */
  'cuenta.anulada': { readonly cuentaId: string; readonly motivo: string };
  'producto.descontinuado': { readonly productoId: string; readonly descontinuado: boolean };
  'cliente.creado': { readonly nombre: string; readonly telefono?: string; readonly nota?: string };
  'cliente.editado': { readonly clienteId: string; readonly nombre: string; readonly telefono?: string; readonly nota?: string };
  /**
   * Reserva. `tolerancia`: minutos que se espera después de la hora (más la demora avisada)
   * antes de poder cancelarla. `avisado`: quien la tomó le dijo al cliente ese tiempo.
   */
  'reserva.creada': {
    readonly cliente: RefCliente;
    readonly telefono?: string;
    /** 'AAAA-MM-DD' y 'HH:MM' (hora local) */
    readonly fecha: string;
    readonly hora: string;
    readonly personas: number;
    readonly mesaId?: string;
    readonly tolerancia: number;
    readonly avisado: boolean;
    readonly nota?: string;
  };
  /** Llamada para confirmar: contestó o no contestó. */
  'reserva.llamada': { readonly reservaId: string; readonly contesto: boolean };
  /** El cliente avisó que llega tarde: corre la hora esperada. */
  'reserva.demora': { readonly reservaId: string; readonly minutos: number };
  /** Llegó. Si se sentó en una mesa, `cuentaId` es la cuenta que se abrió. */
  'reserva.llego': { readonly reservaId: string; readonly cuentaId?: string };
  'reserva.noLlego': { readonly reservaId: string };
  'reserva.cancelada': { readonly reservaId: string; readonly motivo: string };
}

export type TipoEvento = keyof Datos;

export const TIPOS_EVENTO: readonly TipoEvento[] = [
  'usuario.creado',
  'usuario.pin',
  'usuario.desactivado',
  'producto.creado',
  'producto.editado',
  'producto.archivado',
  'inventario.ajuste',
  'caja.abierta',
  'caja.movimiento',
  'caja.cerrada',
  'venta.registrada',
  'venta.anulada',
  'compra.registrada',
  'compra.aplicada',
  'compra.anulada',
  'pago.factura',
  'gasto.registrado',
  'gasto.anulado',
  'mesa.creada',
  'mesa.retirada',
  'cuenta.abierta',
  'cuenta.pedido',
  'cuenta.quitado',
  'cuenta.precuenta',
  'cuenta.trasladada',
  'cuenta.liberada',
  'cuenta.anulada',
  'cuenta.cliente',
  'producto.descontinuado',
  'cliente.creado',
  'cliente.editado',
  'reserva.creada',
  'reserva.llamada',
  'reserva.demora',
  'reserva.llego',
  'reserva.noLlego',
  'reserva.cancelada',
];

/** Un evento de un tipo concreto. */
export type EventoDe<T extends TipoEvento> = {
  readonly id: string;
  readonly tipo: T;
  readonly en: string;
  readonly por: string;
  readonly datos: Datos[T];
};

/** Unión discriminada de todos los eventos (se distingue por `tipo`). */
export type Evento = { [T in TipoEvento]: EventoDe<T> }[TipoEvento];

/** Lo que pide la pantalla: tipo y datos. El núcleo pone id, hora y autor. */
export type Comando = { [T in TipoEvento]: { readonly tipo: T; readonly datos: Datos[T] } }[TipoEvento];

/** Evento tal como queda en el diario: con el hash que lo encadena al anterior. */
export type Registro = Evento & { readonly hash: string };

/** Arma un evento con id ULID y hora local con desfase. */
export function crearEvento(comando: Comando, por: string, ahora: Date = new Date(), id?: string): Evento {
  return { id: id ?? ulid(ahora.getTime()), tipo: comando.tipo, en: isoConOffset(ahora), por, datos: comando.datos } as Evento;
}

// --- Validación de forma ----------------------------------------------------

type Objeto = Readonly<Record<string, unknown>>;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_ARCHIVO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// Caracteres de control salvo salto de línea y tabulador (en notas largas sí se permiten).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const CONTROL_LINEA = /[\u0000-\u001F\u007F]/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function esObjeto(x: unknown): x is Objeto {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function objeto(x: unknown, donde: string, claves: readonly string[]): Objeto {
  if (!esObjeto(x)) throw new EventoInvalido(`${donde} debe ser un objeto`);
  for (const k of Object.keys(x)) {
    if (!claves.includes(k)) throw new EventoInvalido(`${donde}: campo desconocido «${k.slice(0, 40)}»`);
  }
  return x;
}

/** Texto de una línea (nombres, categorías) o de varias (`multilinea`: notas, motivos). */
function texto(o: Objeto, k: string, max: number, multilinea = false): string {
  const v = o[k];
  if (typeof v !== 'string') throw new EventoInvalido(`«${k}» debe ser texto`);
  if (v.trim().length === 0) throw new EventoInvalido(`«${k}» está vacío`);
  if (v !== v.trim()) throw new EventoInvalido(`«${k}» tiene espacios sobrantes`);
  if (v.length > max) throw new EventoInvalido(`«${k}»: máximo ${max} caracteres`);
  if ((multilinea ? CONTROL : CONTROL_LINEA).test(v)) throw new EventoInvalido(`«${k}» tiene caracteres de control`);
  return v;
}

function textoOpcional(o: Objeto, k: string, max: number, multilinea = false): string | undefined {
  return o[k] === undefined ? undefined : texto(o, k, max, multilinea);
}

function entero(o: Objeto, k: string, min: number, max: number): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) {
    throw new EventoInvalido(`«${k}» debe ser un entero entre ${min} y ${max}`);
  }
  return v;
}

const dinero = (o: Objeto, k: string, min = 0) => entero(o, k, min, MAX_CENTAVOS) as Centavos;
const cantidad = (o: Objeto, k: string, min = 0) => entero(o, k, min, MAX_MILESIMAS) as Milesimas;
const delta = (o: Objeto, k: string) => entero(o, k, -MAX_MILESIMAS, MAX_MILESIMAS) as Milesimas;

function stockOpcional(o: Objeto, k: string): Milesimas | undefined {
  return o[k] === undefined ? undefined : delta(o, k);
}

function uno<T extends string>(o: Objeto, k: string, lista: readonly T[]): T {
  const v = o[k];
  if (typeof v !== 'string' || !(lista as readonly string[]).includes(v)) {
    throw new EventoInvalido(`«${k}» debe ser uno de: ${lista.join(', ')}`);
  }
  return v as T;
}

function booleano(o: Objeto, k: string): boolean {
  const v = o[k];
  if (typeof v !== 'boolean') throw new EventoInvalido(`«${k}» debe ser sí o no`);
  return v;
}

function id(o: Objeto, k: string): string {
  const v = o[k];
  if (typeof v !== 'string' || !esUlid(v)) throw new EventoInvalido(`«${k}» no es un identificador válido`);
  return v;
}

function idArchivo(v: unknown, k: string): string {
  if (typeof v !== 'string' || v.length > LIMITES.idArchivo || !ID_ARCHIVO.test(v)) {
    throw new EventoInvalido(`«${k}» no es un archivo válido`);
  }
  return v;
}

/** Fecha 'AAAA-MM-DD' que existe en el calendario. */
export function esFecha(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = FECHA.exec(v);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d;
}

function fecha(o: Objeto, k: string): string {
  const v = o[k];
  if (!esFecha(v)) throw new EventoInvalido(`«${k}» debe ser una fecha AAAA-MM-DD`);
  return v;
}

function lista(o: Objeto, k: string, min: number, max: number): readonly unknown[] {
  const v = o[k];
  if (!Array.isArray(v) || v.length < min || v.length > max) {
    throw new EventoInvalido(`«${k}» debe tener entre ${min} y ${max} elementos`);
  }
  return v;
}

/** Copia sólo las claves con valor (con `exactOptionalPropertyTypes` no se guarda `undefined`). */
export type SinIndefinidos<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};
export function sinIndefinidos<T extends object>(o: T): SinIndefinidos<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as SinIndefinidos<T>;
}

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Hora 'HH:MM' de 00:00 a 23:59. */
export function esHora(v: unknown): v is string {
  return typeof v === 'string' && HORA.test(v);
}

function horaDe(o: Objeto, k: string): string {
  const v = o[k];
  if (!esHora(v)) throw new EventoInvalido(`«${k}» debe ser una hora HH:MM`);
  return v;
}

function leerRefCliente(x: unknown): RefCliente {
  if (!esObjeto(x)) throw new EventoInvalido('«cliente» debe ser un objeto');
  switch (x.tipo) {
    case 'cliente': {
      const o = objeto(x, 'cliente', ['tipo', 'clienteId']);
      return { tipo: 'cliente', clienteId: id(o, 'clienteId') };
    }
    case 'usuario': {
      const o = objeto(x, 'cliente', ['tipo', 'usuarioId']);
      return { tipo: 'usuario', usuarioId: id(o, 'usuarioId') };
    }
    case 'nombre': {
      const o = objeto(x, 'cliente', ['tipo', 'nombre']);
      return { tipo: 'nombre', nombre: texto(o, 'nombre', LIMITES.nombre) };
    }
    default:
      throw new EventoInvalido('«cliente.tipo» debe ser cliente, usuario o nombre');
  }
}

function leerPin(x: unknown): PinGuardado {
  const o = objeto(x, 'pin', ['sal', 'hash', 'iteraciones']);
  for (const k of ['sal', 'hash'] as const) {
    const v = o[k];
    if (typeof v !== 'string' || v.length > 100 || !BASE64.test(v)) throw new EventoInvalido(`pin.${k} inválido`);
  }
  // Tope de iteraciones: un dato hostil no puede colgar el teléfono al verificar.
  return { sal: o.sal as string, hash: o.hash as string, iteraciones: entero(o, 'iteraciones', 1, 5_000_000) };
}

const CAMPOS_PRODUCTO = ['nombre', 'categoria', 'unidad', 'precio', 'costo', 'stockMinimo', 'codigo', 'copas'] as const;
/** Los que todo producto trae desde el principio; `copas` llegó después y es opcional. */
const CAMPOS_OBLIGATORIOS = CAMPOS_PRODUCTO.filter((k) => k !== 'copas');

function leerCampoProducto(o: Objeto, k: (typeof CAMPOS_PRODUCTO)[number]): unknown {
  switch (k) {
    case 'nombre':
      return texto(o, k, LIMITES.nombre);
    case 'categoria':
      return texto(o, k, LIMITES.categoria);
    case 'unidad':
      return uno(o, k, UNIDADES);
    case 'precio':
      return dinero(o, k);
    case 'costo':
      return o[k] === null ? null : dinero(o, k);
    case 'stockMinimo':
      return o[k] === null ? null : cantidad(o, k);
    case 'codigo':
      return o[k] === null ? null : texto(o, k, LIMITES.codigo);
    case 'copas':
      return o[k] === null ? null : entero(o, k, 1, LIMITES.copas);
  }
}

function leerProducto(x: unknown): DatosProducto {
  const o = objeto(x, 'datos', CAMPOS_PRODUCTO);
  const r: Record<string, unknown> = {};
  for (const k of CAMPOS_OBLIGATORIOS) {
    if (o[k] === undefined) throw new EventoInvalido(`falta «${k}»`);
    r[k] = leerCampoProducto(o, k);
  }
  if (o.copas !== undefined) r.copas = leerCampoProducto(o, 'copas');
  return r as unknown as DatosProducto;
}

function leerCambios(x: unknown): Partial<DatosProducto> {
  const o = objeto(x, 'cambios', CAMPOS_PRODUCTO);
  const r: Record<string, unknown> = {};
  for (const k of CAMPOS_PRODUCTO) if (o[k] !== undefined) r[k] = leerCampoProducto(o, k);
  if (Object.keys(r).length === 0) throw new EventoInvalido('no hay cambios');
  return r as Partial<DatosProducto>;
}

/** Valida los `datos` de un tipo de evento. */
function leerDatos(tipo: TipoEvento, x: unknown): Datos[TipoEvento] {
  switch (tipo) {
    case 'usuario.creado': {
      const o = objeto(x, 'datos', ['nombre', 'rol', 'pin']);
      return { nombre: texto(o, 'nombre', LIMITES.nombre), rol: uno(o, 'rol', ROLES), pin: leerPin(o.pin) };
    }
    case 'usuario.pin': {
      const o = objeto(x, 'datos', ['usuarioId', 'pin']);
      return { usuarioId: id(o, 'usuarioId'), pin: leerPin(o.pin) };
    }
    case 'usuario.desactivado': {
      const o = objeto(x, 'datos', ['usuarioId']);
      return { usuarioId: id(o, 'usuarioId') };
    }
    case 'producto.creado':
      return leerProducto(x);
    case 'producto.editado': {
      const o = objeto(x, 'datos', ['productoId', 'cambios']);
      return { productoId: id(o, 'productoId'), cambios: leerCambios(o.cambios) };
    }
    case 'producto.archivado': {
      const o = objeto(x, 'datos', ['productoId']);
      return { productoId: id(o, 'productoId') };
    }
    case 'inventario.ajuste': {
      const o = objeto(x, 'datos', ['productoId', 'delta', 'motivo', 'antes', 'despues', 'nota']);
      return sinIndefinidos({
        productoId: id(o, 'productoId'),
        delta: delta(o, 'delta'),
        motivo: uno(o, 'motivo', MOTIVOS_AJUSTE),
        antes: stockOpcional(o, 'antes'),
        despues: stockOpcional(o, 'despues'),
        nota: textoOpcional(o, 'nota', LIMITES.nota, true),
      });
    }
    case 'caja.abierta': {
      const o = objeto(x, 'datos', ['base']);
      return { base: dinero(o, 'base') };
    }
    case 'caja.movimiento': {
      const o = objeto(x, 'datos', ['tipo', 'monto', 'motivo']);
      return {
        tipo: uno(o, 'tipo', ['ingreso', 'retiro'] as const),
        monto: dinero(o, 'monto', 1),
        motivo: texto(o, 'motivo', LIMITES.motivo, true),
      };
    }
    case 'caja.cerrada': {
      const o = objeto(x, 'datos', ['cajaId', 'contado', 'esperado', 'diferencia', 'confirmado', 'nota']);
      return sinIndefinidos({
        cajaId: id(o, 'cajaId'),
        contado: dinero(o, 'contado'),
        esperado: entero(o, 'esperado', -MAX_CENTAVOS * 10, MAX_CENTAVOS * 10) as Centavos,
        diferencia: entero(o, 'diferencia', -MAX_CENTAVOS * 20, MAX_CENTAVOS * 20) as Centavos,
        confirmado: booleano(o, 'confirmado'),
        nota: textoOpcional(o, 'nota', LIMITES.nota, true),
      });
    }
    case 'venta.registrada': {
      const o = objeto(x, 'datos', ['cajaId', 'lineas', 'descuento', 'total', 'pagos', 'recibido', 'cambio', 'cuentaId']);
      const lineas = lista(o, 'lineas', 1, LIMITES.lineas).map((l): LineaVenta => {
        const r = objeto(l, 'línea', ['productoId', 'nombre', 'cantidad', 'precioUnit', 'subtotal']);
        return {
          productoId: id(r, 'productoId'),
          nombre: texto(r, 'nombre', LIMITES.nombre),
          cantidad: cantidad(r, 'cantidad', 1),
          precioUnit: dinero(r, 'precioUnit'),
          subtotal: entero(r, 'subtotal', 0, Number.MAX_SAFE_INTEGER) as Centavos,
        };
      });
      // Sin pagos sólo si el total es cero (lo comprueba `validar`).
      const pagos = lista(o, 'pagos', 0, LIMITES.pagos).map((p): PagoVenta => {
        const r = objeto(p, 'pago', ['forma', 'monto']);
        return { forma: uno(r, 'forma', FORMAS_PAGO), monto: dinero(r, 'monto', 1) };
      });
      let descuento: DescuentoAplicado | undefined;
      if (o.descuento !== undefined) {
        const d = objeto(o.descuento, 'descuento', ['tipo', 'valor', 'monto']);
        const tipoD = uno(d, 'tipo', ['porcentaje', 'valor'] as const);
        descuento = {
          tipo: tipoD,
          valor: tipoD === 'porcentaje' ? entero(d, 'valor', 0, 100) : dinero(d, 'valor'),
          monto: dinero(d, 'monto'),
        };
      }
      return sinIndefinidos({
        cajaId: id(o, 'cajaId'),
        lineas,
        descuento,
        total: dinero(o, 'total'),
        pagos,
        recibido: o.recibido === undefined ? undefined : dinero(o, 'recibido'),
        cambio: o.cambio === undefined ? undefined : dinero(o, 'cambio'),
        cuentaId: o.cuentaId === undefined ? undefined : id(o, 'cuentaId'),
      });
    }
    case 'venta.anulada': {
      const o = objeto(x, 'datos', ['ventaId', 'motivo']);
      return { ventaId: id(o, 'ventaId'), motivo: texto(o, 'motivo', LIMITES.motivo, true) };
    }
    case 'compra.registrada': {
      const o = objeto(x, 'datos', ['proveedor', 'numero', 'fecha', 'vence', 'lineas', 'total', 'adjuntos', 'nota']);
      const lineas = lista(o, 'lineas', 1, LIMITES.lineas).map((l): LineaCompra => {
        const r = objeto(l, 'línea', ['productoId', 'cantidad', 'costoUnit']);
        return { productoId: id(r, 'productoId'), cantidad: cantidad(r, 'cantidad', 1), costoUnit: dinero(r, 'costoUnit') };
      });
      return sinIndefinidos({
        proveedor: texto(o, 'proveedor', LIMITES.proveedor),
        numero: texto(o, 'numero', LIMITES.numeroFactura),
        fecha: fecha(o, 'fecha'),
        vence: o.vence === undefined ? undefined : fecha(o, 'vence'),
        lineas,
        total: dinero(o, 'total'),
        adjuntos: lista(o, 'adjuntos', 0, LIMITES.adjuntos).map((a) => idArchivo(a, 'adjuntos')),
        nota: textoOpcional(o, 'nota', LIMITES.nota, true),
      });
    }
    case 'compra.aplicada': {
      const o = objeto(x, 'datos', ['compraId']);
      return { compraId: id(o, 'compraId') };
    }
    case 'compra.anulada': {
      const o = objeto(x, 'datos', ['compraId', 'motivo']);
      return { compraId: id(o, 'compraId'), motivo: texto(o, 'motivo', LIMITES.motivo, true) };
    }
    case 'pago.factura': {
      const o = objeto(x, 'datos', ['compraId', 'monto', 'forma', 'deCaja']);
      return {
        compraId: id(o, 'compraId'),
        monto: dinero(o, 'monto', 1),
        forma: uno(o, 'forma', ['efectivo', 'tarjeta', 'transferencia'] as const),
        deCaja: booleano(o, 'deCaja'),
      };
    }
    case 'gasto.registrado': {
      const o = objeto(x, 'datos', ['categoria', 'descripcion', 'monto', 'forma', 'deCaja', 'adjunto']);
      return sinIndefinidos({
        categoria: texto(o, 'categoria', LIMITES.categoria),
        descripcion: texto(o, 'descripcion', LIMITES.descripcion, true),
        monto: dinero(o, 'monto', 1),
        forma: uno(o, 'forma', ['efectivo', 'tarjeta', 'transferencia'] as const),
        deCaja: booleano(o, 'deCaja'),
        adjunto: o.adjunto === undefined ? undefined : idArchivo(o.adjunto, 'adjunto'),
      });
    }
    case 'gasto.anulado': {
      const o = objeto(x, 'datos', ['gastoId', 'motivo']);
      return { gastoId: id(o, 'gastoId'), motivo: texto(o, 'motivo', LIMITES.motivo, true) };
    }
    case 'mesa.creada': {
      const o = objeto(x, 'datos', ['nombre', 'zona']);
      return { nombre: texto(o, 'nombre', LIMITES.nombre), zona: texto(o, 'zona', LIMITES.categoria) };
    }
    case 'mesa.retirada': {
      const o = objeto(x, 'datos', ['mesaId']);
      return { mesaId: id(o, 'mesaId') };
    }
    case 'cuenta.abierta': {
      const o = objeto(x, 'datos', ['mesaId', 'personas', 'cliente']);
      return sinIndefinidos({
        mesaId: id(o, 'mesaId'),
        personas: o.personas === undefined ? undefined : entero(o, 'personas', 1, LIMITES.personas),
        cliente: o.cliente === undefined ? undefined : leerRefCliente(o.cliente),
      });
    }
    case 'cuenta.cliente': {
      const o = objeto(x, 'datos', ['cuentaId', 'cliente']);
      return { cuentaId: id(o, 'cuentaId'), cliente: o.cliente === null ? null : leerRefCliente(o.cliente) };
    }
    case 'producto.descontinuado': {
      const o = objeto(x, 'datos', ['productoId', 'descontinuado']);
      return { productoId: id(o, 'productoId'), descontinuado: booleano(o, 'descontinuado') };
    }
    case 'cliente.creado': {
      const o = objeto(x, 'datos', ['nombre', 'telefono', 'nota']);
      return sinIndefinidos({
        nombre: texto(o, 'nombre', LIMITES.nombre),
        telefono: textoOpcional(o, 'telefono', LIMITES.telefono),
        nota: textoOpcional(o, 'nota', LIMITES.nota, true),
      });
    }
    case 'cliente.editado': {
      const o = objeto(x, 'datos', ['clienteId', 'nombre', 'telefono', 'nota']);
      return sinIndefinidos({
        clienteId: id(o, 'clienteId'),
        nombre: texto(o, 'nombre', LIMITES.nombre),
        telefono: textoOpcional(o, 'telefono', LIMITES.telefono),
        nota: textoOpcional(o, 'nota', LIMITES.nota, true),
      });
    }
    case 'reserva.creada': {
      const o = objeto(x, 'datos', ['cliente', 'telefono', 'fecha', 'hora', 'personas', 'mesaId', 'tolerancia', 'avisado', 'nota']);
      return sinIndefinidos({
        cliente: leerRefCliente(o.cliente),
        telefono: textoOpcional(o, 'telefono', LIMITES.telefono),
        fecha: fecha(o, 'fecha'),
        hora: horaDe(o, 'hora'),
        personas: entero(o, 'personas', 1, LIMITES.personas),
        mesaId: o.mesaId === undefined ? undefined : id(o, 'mesaId'),
        tolerancia: entero(o, 'tolerancia', LIMITES.toleranciaMin, LIMITES.toleranciaMax),
        avisado: booleano(o, 'avisado'),
        nota: textoOpcional(o, 'nota', LIMITES.nota, true),
      });
    }
    case 'reserva.llamada': {
      const o = objeto(x, 'datos', ['reservaId', 'contesto']);
      return { reservaId: id(o, 'reservaId'), contesto: booleano(o, 'contesto') };
    }
    case 'reserva.demora': {
      const o = objeto(x, 'datos', ['reservaId', 'minutos']);
      return { reservaId: id(o, 'reservaId'), minutos: entero(o, 'minutos', 1, LIMITES.demoraMax) };
    }
    case 'reserva.llego': {
      const o = objeto(x, 'datos', ['reservaId', 'cuentaId']);
      return sinIndefinidos({ reservaId: id(o, 'reservaId'), cuentaId: o.cuentaId === undefined ? undefined : id(o, 'cuentaId') });
    }
    case 'reserva.noLlego': {
      const o = objeto(x, 'datos', ['reservaId']);
      return { reservaId: id(o, 'reservaId') };
    }
    case 'reserva.cancelada': {
      const o = objeto(x, 'datos', ['reservaId', 'motivo']);
      return { reservaId: id(o, 'reservaId'), motivo: texto(o, 'motivo', LIMITES.motivo, true) };
    }
    case 'cuenta.pedido': {
      const o = objeto(x, 'datos', ['cuentaId', 'lineas', 'nota']);
      const lineas = lista(o, 'lineas', 1, LIMITES.lineas).map((l): LineaCuenta => {
        const r = objeto(l, 'línea', ['productoId', 'cantidad']);
        return { productoId: id(r, 'productoId'), cantidad: cantidad(r, 'cantidad', 1) };
      });
      return sinIndefinidos({ cuentaId: id(o, 'cuentaId'), lineas, nota: textoOpcional(o, 'nota', LIMITES.nota, true) });
    }
    case 'cuenta.quitado': {
      const o = objeto(x, 'datos', ['cuentaId', 'productoId', 'cantidad', 'motivo']);
      return {
        cuentaId: id(o, 'cuentaId'),
        productoId: id(o, 'productoId'),
        cantidad: cantidad(o, 'cantidad', 1),
        motivo: texto(o, 'motivo', LIMITES.motivo, true),
      };
    }
    case 'cuenta.precuenta': {
      const o = objeto(x, 'datos', ['cuentaId', 'pedida']);
      return { cuentaId: id(o, 'cuentaId'), pedida: booleano(o, 'pedida') };
    }
    case 'cuenta.trasladada': {
      const o = objeto(x, 'datos', ['cuentaId', 'mesaId']);
      return { cuentaId: id(o, 'cuentaId'), mesaId: id(o, 'mesaId') };
    }
    case 'cuenta.liberada': {
      const o = objeto(x, 'datos', ['cuentaId']);
      return { cuentaId: id(o, 'cuentaId') };
    }
    case 'cuenta.anulada': {
      const o = objeto(x, 'datos', ['cuentaId', 'motivo']);
      return { cuentaId: id(o, 'cuentaId'), motivo: texto(o, 'motivo', LIMITES.motivo, true) };
    }
  }
}

/** Valida un comando (tipo + datos) que viene de la pantalla. Devuelve una copia limpia. */
export function leerComando(x: unknown): Comando {
  const o = objeto(x, 'comando', ['tipo', 'datos']);
  const tipo = uno(o, 'tipo', TIPOS_EVENTO);
  return { tipo, datos: leerDatos(tipo, o.datos) } as Comando;
}

/** Valida un evento completo (por ejemplo, leído del disco). Devuelve una copia limpia. */
export function leerEvento(x: unknown): Evento {
  const o = objeto(x, 'evento', ['id', 'tipo', 'en', 'por', 'datos']);
  const en = o.en;
  if (typeof en !== 'string' || !ISO.test(en) || !esFecha(en.slice(0, 10))) {
    throw new EventoInvalido('«en» debe ser fecha y hora ISO con desfase');
  }
  const tipo = uno(o, 'tipo', TIPOS_EVENTO);
  return { id: id(o, 'id'), tipo, en, por: id(o, 'por'), datos: leerDatos(tipo, o.datos) } as Evento;
}

/** Valida un registro del diario (evento + hash). */
export function leerRegistro(x: unknown): Registro {
  if (!esObjeto(x)) throw new EventoInvalido('registro debe ser un objeto');
  const { hash, ...resto } = x;
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) throw new EventoInvalido('hash inválido');
  return { ...leerEvento(resto), hash };
}

/** Fecha local ('AAAA-MM-DD') de un evento: los primeros 10 caracteres de `en`. */
export function diaDe(evento: { readonly en: string }): string {
  return evento.en.slice(0, 10);
}
