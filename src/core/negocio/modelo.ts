/**
 * Modelo de Stark: las cosas del negocio tal como las ve el estado proyectado.
 *
 * Todo es dato plano (sin clases ni fechas `Date`): el estado completo se guarda tal cual
 * en `negocio/instantanea.json` y se vuelve a leer con `JSON.parse`.
 * Los campos opcionales usan `null` (no `undefined`) para que el JSON los conserve.
 */
import type { Centavos, Milesimas } from './numeros';

export const UNIDADES = ['unidad', 'g', 'kg', 'ml', 'L'] as const;
export type Unidad = (typeof UNIDADES)[number];

/**
 * Cargos. `dueno` sin eñe en el código (identificador); en pantalla se escribe «Dueño».
 * `mesero` toma pedidos en las mesas, pero no cobra ni toca la caja.
 */
export const ROLES = ['dueno', 'cajero', 'bodega', 'mesero'] as const;
export type Rol = (typeof ROLES)[number];

export const NOMBRE_ROL: Readonly<Record<Rol, string>> = { dueno: 'Dueño', cajero: 'Cajero', bodega: 'Bodega', mesero: 'Mesero' };

/**
 * Formas de pago. Nequi y Daviplata cuentan como `transferencia`. `cortesia` es lo que se
 * regala (sale del inventario y se registra como venta, pero no entra plata).
 */
export const FORMAS_PAGO = ['efectivo', 'tarjeta', 'transferencia', 'cortesia'] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];
export const NOMBRE_FORMA: Readonly<Record<FormaPago, string>> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia (Nequi, Daviplata, banco)',
  cortesia: 'Cortesía',
};
/** Con qué se le paga a un proveedor o un gasto: lo mismo, menos la cortesía. */
export type FormaEgreso = Exclude<FormaPago, 'cortesia'>;
export const FORMAS_EGRESO: readonly FormaEgreso[] = ['efectivo', 'tarjeta', 'transferencia'];

/** Por qué cambió el stock fuera de una venta o una compra. */
export const MOTIVOS_AJUSTE = ['conteo', 'merma', 'importacion', 'correccion', 'consumo'] as const;
export type MotivoAjuste = (typeof MOTIVOS_AJUSTE)[number];

export interface Producto {
  readonly id: string;
  readonly nombre: string;
  readonly categoria: string;
  readonly unidad: Unidad;
  /** Precio de venta por unidad, con impuestos incluidos. */
  readonly precio: Centavos;
  /** Último costo por unidad (lo pone la última factura de compra aplicada). */
  readonly costo: Centavos | null;
  readonly stockMinimo: Milesimas | null;
  readonly codigo?: string;
  readonly activo: boolean;
}

/** PIN guardado: nunca el PIN, sólo su derivación PBKDF2 (ver `pin.ts`). */
export interface PinGuardado {
  /** Sal aleatoria en base64 (16 bytes). */
  readonly sal: string;
  /** Hash PBKDF2-SHA256 en base64 (32 bytes). */
  readonly hash: string;
  readonly iteraciones: number;
}

export interface Usuario {
  readonly id: string;
  readonly nombre: string;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly pin: PinGuardado;
}

/** Una mesa (o barra, o silla): donde se abre una cuenta. */
export interface Mesa {
  readonly id: string;
  readonly nombre: string;
  /** Salón, terraza, barra… (agrupa el mapa). */
  readonly zona: string;
  readonly activa: boolean;
}

/** Límites de texto y de tamaño: el diario rechaza lo que se salga (entradas hostiles). */
export const LIMITES = {
  nombre: 80,
  categoria: 40,
  codigo: 40,
  motivo: 300,
  nota: 500,
  proveedor: 120,
  numeroFactura: 40,
  descripcion: 300,
  lineas: 100,
  pagos: 4,
  adjuntos: 10,
  idArchivo: 80,
  mesas: 200,
  personas: 99,
} as const;
