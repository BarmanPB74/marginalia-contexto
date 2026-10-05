import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { alternarLista, alternarNegrita, alternarTarea, insertarEnlace } from '../../src/features/notas/editor/formato';

/** "|" marca el cursor; "[" y "]" una selección. */
function estado(texto: string): EditorState {
  const cursor = texto.indexOf('|');
  if (cursor >= 0) {
    return EditorState.create({ doc: texto.replace('|', ''), selection: EditorSelection.cursor(cursor) });
  }
  const desde = texto.indexOf('[');
  const hasta = texto.indexOf(']') - 1;
  return EditorState.create({ doc: texto.replace('[', '').replace(']', ''), selection: EditorSelection.range(desde, hasta) });
}

function aplicar(e: EditorState, accion: (e: EditorState) => TransactionSpec): string {
  const nuevo = e.update(accion(e)).state;
  const { from, to } = nuevo.selection.main;
  const doc = nuevo.doc.toString();
  return from === to ? doc.slice(0, from) + '|' + doc.slice(from) : doc.slice(0, from) + '[' + doc.slice(from, to) + ']' + doc.slice(to);
}

describe('negrita', () => {
  it('envuelve la selección y la deja seleccionada', () => {
    expect(aplicar(estado('hola [mundo] x'), alternarNegrita)).toBe('hola **[mundo]** x');
  });
  it('sin selección deja el cursor entre los asteriscos', () => {
    expect(aplicar(estado('hola |'), alternarNegrita)).toBe('hola **|**');
  });
  it('si ya está en negrita, la quita', () => {
    expect(aplicar(estado('hola **[mundo]** x'), alternarNegrita)).toBe('hola [mundo] x');
  });
});

describe('lista y tarea', () => {
  it('lista: añade y quita "- " en la línea del cursor', () => {
    expect(aplicar(estado('compr|ar pan'), alternarLista)).toBe('- compr|ar pan');
    expect(aplicar(estado('- compr|ar pan'), alternarLista)).toBe('compr|ar pan');
  });
  it('lista: afecta a todas las líneas seleccionadas', () => {
    expect(aplicar(estado('[uno\ndos]\ntres'), alternarLista)).toBe('- [uno\n- dos]\ntres');
  });
  it('lista: una tarea vuelve a texto normal', () => {
    expect(aplicar(estado('- [ ] le|che'), alternarLista)).toBe('le|che');
  });
  it('tarea: texto → tarea → texto, y un elemento de lista pasa a tarea', () => {
    expect(aplicar(estado('le|che'), alternarTarea)).toBe('- [ ] le|che');
    expect(aplicar(estado('- [x] le|che'), alternarTarea)).toBe('le|che');
    expect(aplicar(estado('- le|che'), alternarTarea)).toBe('- [ ] le|che');
  });
  it('en una línea vacía deja el cursor tras el prefijo', () => {
    expect(aplicar(estado('|'), alternarTarea)).toBe('- [ ] |');
  });
});

describe('enlace', () => {
  it('convierte la selección en texto del enlace y pone el cursor en la dirección', () => {
    expect(aplicar(estado('ver [la web] hoy'), insertarEnlace)).toBe('ver [la web](|) hoy');
  });
  it('sin selección deja el cursor para escribir el texto', () => {
    expect(aplicar(estado('ver |'), insertarEnlace)).toBe('ver [|]()');
  });
});
