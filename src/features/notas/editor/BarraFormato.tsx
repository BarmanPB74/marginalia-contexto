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
 * «@ Fecha» abre el selector de fecha (la nota aparecerá ese día en el Calendario). ♪ canción llega en F4.
 */
interface Props {
  vista: RefObject<EditorView | null>;
  alPedirFecha?: () => void;
  /** Inserta la canción que sonaba (con su segundo) */
  alPonerCancion?: () => void;
}

export function BarraFormato({ vista, alPedirFecha, alPonerCancion }: Props) {
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
      {alPonerCancion && (
        <button
          type="button"
          class="barra-formato__boton"
          aria-label="Canción que sonaba"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={alPonerCancion}
        >
          ♪
        </button>
      )}
      {alPedirFecha && (
        <button
          type="button"
          class="barra-formato__boton"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={alPedirFecha}
        >
          @ Fecha
        </button>
      )}
    </div>
  );
}
