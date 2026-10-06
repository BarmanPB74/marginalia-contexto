import { strToU8, unzipSync, zipSync } from 'fflate';
import { escribirNota, leerNota, TAMANO_MAXIMO, type Nota } from '../notas/nota';

/**
 * Copia de todas las notas en un ZIP (historia 7, docs/FORMATO_NOTAS.md):
 * `notas/<id>.md` (el mismo formato de siempre, **descifrado**) + `LEEME.txt`.
 * Importar valida todo como entrada hostil: rutas, tamaños, cantidad y esquema de cada nota.
 * Funciones puras: bytes ↔ notas. Guardar y leer archivos es cosa de quien llama.
 */

export const MAX_ARCHIVOS = 2000;
/** Tamaño máximo del ZIP que se acepta para importar. */
export const MAX_ZIP = 100 * 1024 * 1024;
/** Suma máxima de lo descomprimido (frena las "bombas zip"). */
export const MAX_TOTAL = 300 * 1024 * 1024;

const LEEME = `Copia de notas de Marginalia
============================

Cada archivo de notas/ es una nota en Markdown, sin cifrar, con su
encabezado YAML (id, título, fechas, etiquetas, página madre).
El nombre del archivo es el id de la nota; el título está dentro.

Se abren con cualquier editor de texto, Obsidian, VS Code o Typora.
Para recuperarlas en Marginalia: Ajustes → Importar notas (ZIP).

Guarda esta copia en un lugar seguro: no está cifrada.
`;

export function exportarZip(notas: readonly Nota[]): Uint8Array {
  const archivos: Record<string, Uint8Array> = { 'LEEME.txt': strToU8(LEEME) };
  for (const nota of notas) archivos[`notas/${nota.id}.md`] = strToU8(escribirNota(nota));
  // Fecha fija dentro del ZIP: la misma copia da los mismos bytes (y no revela la hora local)
  return zipSync(archivos, { level: 6, mtime: new Date(Date.UTC(2026, 0, 1)) });
}

export class ZipInvalido extends Error {
  constructor(motivo: string) {
    super(`ZIP no válido: ${motivo}`);
    this.name = 'ZipInvalido';
  }
}

export interface Rechazo {
  archivo: string;
  motivo: string;
}

export interface ResultadoLectura {
  notas: Nota[];
  rechazados: Rechazo[];
}

/**
 * Nombre de entrada aceptable: tramos sin "..", sin rutas absolutas ni de Windows, sin ocultos,
 * terminado en `.md`. Aunque la app nunca escribe usando este nombre (escribe por id), un
 * nombre raro delata un ZIP manipulado: se rechaza.
 */
function nombreSeguro(nombre: string): boolean {
  if (nombre.length > 255 || nombre.includes('\\') || nombre.includes('\0') || nombre.startsWith('/')) return false;
  if (/^[A-Za-z]:/.test(nombre)) return false;
  return nombre.split('/').every((t) => t !== '' && t !== '.' && t !== '..' && !t.startsWith('.'));
}

export function leerZip(bytes: Uint8Array): ResultadoLectura {
  if (bytes.length > MAX_ZIP) throw new ZipInvalido('supera 100 MB');
  const rechazados: Rechazo[] = [];
  let entradas = 0;
  let total = 0;
  let contenido: Record<string, Uint8Array>;
  try {
    contenido = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith('/')) return false; // carpetas
        if (++entradas > MAX_ARCHIVOS) throw new ZipInvalido(`más de ${MAX_ARCHIVOS} archivos`);
        if (!f.name.toLowerCase().endsWith('.md')) return false; // LEEME.txt, imágenes…: se ignoran
        if (!nombreSeguro(f.name)) {
          rechazados.push({ archivo: f.name, motivo: 'ruta no permitida' });
          return false;
        }
        if (f.originalSize > TAMANO_MAXIMO) {
          rechazados.push({ archivo: f.name, motivo: 'supera 2 MB' });
          return false;
        }
        total += f.originalSize;
        if (total > MAX_TOTAL) throw new ZipInvalido('demasiado grande al descomprimir');
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ZipInvalido) throw e;
    throw new ZipInvalido('no se pudo leer (¿está dañado o no es un ZIP?)');
  }

  const notas: Nota[] = [];
  const vistos = new Set<string>();
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  for (const [nombre, datos] of Object.entries(contenido)) {
    try {
      // El tamaño declarado puede mentir: se vuelve a comprobar lo realmente descomprimido
      if (datos.length > TAMANO_MAXIMO) throw new Error('supera 2 MB');
      const nota = leerNota(utf8.decode(datos));
      if (vistos.has(nota.id)) throw new Error('id repetido en el ZIP');
      vistos.add(nota.id);
      notas.push(nota);
    } catch (e) {
      const motivo = e instanceof TypeError ? 'no es texto UTF-8' : e instanceof Error ? e.message : 'no válida';
      rechazados.push({ archivo: nombre, motivo });
    }
  }
  return { notas, rechazados };
}
