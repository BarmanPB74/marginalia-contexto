import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { diaDe, type Dia } from '../../../core/notas/fechas';
import { claveEtiqueta } from '../../../core/parser/parser';
import { normalizar } from '../../../core/comandos/buscar';

/**
 * Autocompletar del editor (F3): `#` sugiere las etiquetas que ya existen y `@` sugiere fechas
 * cercanas, con su nombre en palabras. Las listas son funciones puras; las fuentes de
 * CodeMirror solo las conectan con el cursor.
 */

export interface SugerenciaFecha {
  dia: Dia;
  nombre: string;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function sumarDias(fecha: Date, n: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + n);
}

/** Hoy, mañana, pasado mañana y los próximos días de la semana (hasta 7 días). */
export function sugerenciasFecha(hoy: Date): SugerenciaFecha[] {
  const lista: SugerenciaFecha[] = [
    { dia: diaDe(hoy), nombre: 'hoy' },
    { dia: diaDe(sumarDias(hoy, 1)), nombre: 'mañana' },
    { dia: diaDe(sumarDias(hoy, 2)), nombre: 'pasado mañana' },
  ];
  for (let n = 3; n <= 7; n++) {
    const fecha = sumarDias(hoy, n);
    lista.push({ dia: diaDe(fecha), nombre: `${n === 7 ? 'el próximo ' : ''}${DIAS[fecha.getDay()]}` });
  }
  return lista;
}

/** Etiquetas conocidas que empiezan (o contienen) lo escrito, sin tildes ni mayúsculas. */
export function sugerenciasEtiqueta(escrito: string, conocidas: readonly string[], maximo = 8): string[] {
  const buscado = normalizar(escrito);
  const vistas = new Set<string>();
  const unicas = conocidas.filter((e) => {
    const k = claveEtiqueta(e);
    if (vistas.has(k) || claveEtiqueta(e) === claveEtiqueta(escrito)) return false;
    vistas.add(k);
    return true;
  });
  const empiezan = unicas.filter((e) => normalizar(e).startsWith(buscado));
  const contienen = unicas.filter((e) => !normalizar(e).startsWith(buscado) && normalizar(e).includes(buscado));
  return [...empiezan, ...contienen].slice(0, maximo);
}

/** Lo que va justo antes del `#`/`@`: inicio de línea, espacio o paréntesis (como el parser). */
function bienPrecedido(contexto: CompletionContext, desde: number): boolean {
  const antes = contexto.state.sliceDoc(Math.max(0, desde - 1), desde);
  return desde === 0 || /[\s([{¡¿"'«]/.test(antes);
}

export function fuenteEtiquetas(conocidas: () => readonly string[]): CompletionSource {
  return (contexto): CompletionResult | null => {
    const palabra = contexto.matchBefore(/#[\p{L}\p{N}_\-/]*/u);
    if (!palabra || !bienPrecedido(contexto, palabra.from)) return null;
    const escrito = palabra.text.slice(1);
    const opciones: Completion[] = sugerenciasEtiqueta(escrito, conocidas()).map((e) => ({
      label: `#${e}`,
      apply: `#${e} `,
      type: 'keyword',
    }));
    return opciones.length ? { from: palabra.from, options: opciones, filter: false } : null;
  };
}

export function fuenteFechas(hoy: () => Date, alElegirEnCalendario?: (desde: number, hasta: number) => void): CompletionSource {
  return (contexto): CompletionResult | null => {
    const palabra = contexto.matchBefore(/@[\p{L}\d-]*/u);
    if (!palabra || !bienPrecedido(contexto, palabra.from)) return null;
    const escrito = normalizar(palabra.text.slice(1));
    const opciones: Completion[] = sugerenciasFecha(hoy())
      .filter((s) => !escrito || normalizar(s.nombre).includes(escrito) || s.dia.startsWith(escrito))
      .map((s, i) => ({
        label: `@${s.dia}`,
        detail: s.nombre,
        apply: `@${s.dia} `,
        type: 'constant',
        boost: -i,
      }));
    if (alElegirEnCalendario) {
      opciones.push({
        label: 'Elegir en el calendario…',
        type: 'text',
        boost: -99,
        apply: (_vista, _opcion, desde, hasta) => alElegirEnCalendario(desde, hasta),
      });
    }
    return { from: palabra.from, options: opciones, filter: false };
  };
}
