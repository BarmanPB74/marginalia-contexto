import { EditorSelection, type ChangeSpec, type EditorState, type TransactionSpec } from '@codemirror/state';

/**
 * Acciones de la barra de formato. Funciones puras: estado → cambios, para poder
 * probarlas sin pantalla. Trabajan sobre la selección principal.
 */

export function alternarNegrita(estado: EditorState): TransactionSpec {
  const { from, to } = estado.selection.main;
  const antes = estado.sliceDoc(Math.max(0, from - 2), from);
  const despues = estado.sliceDoc(to, to + 2);
  if (antes === '**' && despues === '**') {
    return {
      changes: [
        { from: from - 2, to: from },
        { from: to, to: to + 2 },
      ],
      selection: EditorSelection.range(from - 2, to - 2),
    };
  }
  return {
    changes: [
      { from, insert: '**' },
      { from: to, insert: '**' },
    ],
    selection: EditorSelection.range(from + 2, to + 2),
  };
}

const LISTA = /^- (\[[ xX]\] )?/;
const TAREA = /^- \[[ xX]\] /;

/** Aplica `cambiar` a cada línea tocada por la selección y recoloca el cursor. */
function porLinea(estado: EditorState, cambiar: (texto: string, inicio: number) => ChangeSpec | null): TransactionSpec {
  const { from, to } = estado.selection.main;
  const cambios: ChangeSpec[] = [];
  const primera = estado.doc.lineAt(from).number;
  const ultima = estado.doc.lineAt(to).number;
  for (let n = primera; n <= ultima; n++) {
    const linea = estado.doc.line(n);
    const cambio = cambiar(linea.text, linea.from);
    if (cambio) cambios.push(cambio);
  }
  const conjunto = estado.changes(cambios);
  // assoc 1: si el texto se inserta justo en el cursor, el cursor queda detrás ("- [ ] |")
  return { changes: conjunto, selection: estado.selection.map(conjunto, 1) };
}

export function alternarLista(estado: EditorState): TransactionSpec {
  return porLinea(estado, (texto, inicio) => {
    const marca = LISTA.exec(texto);
    return marca ? { from: inicio, to: inicio + marca[0].length } : { from: inicio, insert: '- ' };
  });
}

export function alternarTarea(estado: EditorState): TransactionSpec {
  return porLinea(estado, (texto, inicio) => {
    const tarea = TAREA.exec(texto);
    if (tarea) return { from: inicio, to: inicio + tarea[0].length };
    if (texto.startsWith('- ')) return { from: inicio + 2, insert: '[ ] ' };
    return { from: inicio, insert: '- [ ] ' };
  });
}

export function insertarEnlace(estado: EditorState): TransactionSpec {
  const { from, to } = estado.selection.main;
  if (from === to) return { changes: { from, insert: '[]()' }, selection: EditorSelection.cursor(from + 1) };
  return {
    changes: [
      { from, insert: '[' },
      { from: to, insert: ']()' },
    ],
    // tras "[texto](" → el cursor queda donde va la dirección
    selection: EditorSelection.cursor(to + 3),
  };
}

/** Inserta `@AAAA-MM-DD` (por defecto, hoy) en el cursor: la nota aparece ese día en el Calendario. */
export function insertarFecha(estado: EditorState, dia: string): TransactionSpec {
  const { from, to } = estado.selection.main;
  const antes = estado.sliceDoc(Math.max(0, from - 1), from);
  // Una @fecha pegada a una palabra no cuenta (FORMATO_NOTAS.md): se separa con un espacio.
  const texto = `${antes && !/\s/.test(antes) ? ' ' : ''}@${dia} `;
  return { changes: { from, to, insert: texto }, selection: EditorSelection.cursor(from + texto.length) };
}
