import type { EditorState, TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { RefObject } from 'preact';
import { alternarLista, alternarNegrita, alternarTarea, insertarEnlace } from './formato';
import './BarraFormato.css';

const ACCIONES: [string, (e: EditorState) => TransactionSpec][] = [
  ['Negrita', alternarNegrita],
  ['Lista', alternarLista],
  ['Tarea', alternarTarea],
  ['Enlace', insertarEnlace],
];

/**
 * Barra mínima sobre el teclado (DISENO.md). Solo aparece mientras se escribe.
 * ♪ canción y @ fecha llegan en F3/F4.
 */
export function BarraFormato({ vista }: { vista: RefObject<EditorView | null> }) {
  return (
    <div class="barra-formato" role="toolbar" aria-label="Formato">
      {ACCIONES.map(([nombre, accion]) => (
        <button
          key={nombre}
          type="button"
          class="barra-formato__boton"
          // Sin esto, tocar el botón quita el foco al editor y el teclado se cierra.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const editor = vista.current;
            if (!editor) return;
            editor.dispatch(accion(editor.state));
            editor.focus();
          }}
        >
          {nombre}
        </button>
      ))}
    </div>
  );
}
