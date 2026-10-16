/**
 * Tipos, límites y errores de «Importar inventario (Excel o CSV)».
 * Todo el módulo es puro: recibe bytes o tablas y devuelve datos; no toca UI ni almacenamiento.
 */

// Tipos de marca compartidos con el resto del negocio: se crean con `milesimas()` / `centavos()`.
import type { Centavos, Milesimas } from '../numeros';
export type { Centavos, Milesimas };

/** Tabla leída del archivo: filas de celdas de texto ya limpias (sin &nbsp; ni espacios dobles). */
export type Tabla = string[][];

/** Límites anti-abuso: el archivo viene de fuera y se trata como entrada hostil. */
export const LIMITES = {
  /** Tamaño máximo del archivo, en bytes. */
  bytes: 10 * 1024 * 1024,
  filas: 20_000,
  columnas: 50,
  /** Las celdas más largas se recortan a este número de caracteres. */
  caracteresCelda: 500,
  /** Suma máxima de lo descomprimido de un .xlsx (frena las «bombas zip»). */
  xlsxDescomprimido: 50 * 1024 * 1024,
  /** Los nombres de producto se recortan a este largo. */
  caracteresNombre: 120,
  /** Texto de categoría, código y unidad. */
  caracteresCampo: 60,
  /**
   * Tope de cordura de `leerEscalado`, en unidades. Los topes de negocio (cantidad ≤ 1 000 000
   * unidades, dinero ≤ $ 100 000 000) los aplica `filasImportables` con los de `../numeros`.
   */
  magnitudMaxima: 1_000_000_000,
} as const;

/** Error con un mensaje listo para mostrar a la persona, en español. */
export class ErrorImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorImportacion';
  }
}

/** Campos que se pueden leer de una columna. */
export type CampoImportable = 'nombre' | 'cantidad' | 'precio' | 'costo' | 'categoria' | 'codigo' | 'unidad';

/** Índice (desde 0) de la columna que alimenta cada campo. La UI deja corregirlo. */
export type MapeoColumnas = Partial<Record<CampoImportable, number>>;

/**
 * Cómo se escriben los decimales cuando el número es ambiguo («1.500»):
 * - `es-CO`: punto de miles y coma decimal (1.234,50).
 * - `en`: coma de miles y punto decimal (1,234.50).
 */
export type Convencion = 'es-CO' | 'en';

export interface FilaImportable {
  nombre: string;
  cantidad: Milesimas;
  precio?: Centavos;
  costo?: Centavos;
  categoria?: string;
  codigo?: string;
  unidad?: string;
  /** Número de fila en la tabla original, desde 1 (como lo muestra Excel). */
  filaOriginal: number;
}

export interface ErrorFila {
  /** Número de fila en la tabla original, desde 1. */
  fila: number;
  motivo: string;
}
