import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { lenguajeMarkdown } from './lenguaje';
import './EditorMarkdown.css';

interface Props {
  /** Texto inicial. Para cambiar de nota se monta otro editor (key). */
  valor: string;
  alCambiar: (valor: string) => void;
  alEnfocar?: (enfocado: boolean) => void;
  /** Para que la barra de formato actúe sobre este editor. */
  vista?: RefObject<EditorView | null>;
  enfocarAlAbrir?: boolean;
}

/** Editor Markdown (CodeMirror 6): lienzo casi vacío, sin números de línea ni bordes. */
export function EditorMarkdown({ valor, alCambiar, alEnfocar, vista, enfocarAlAbrir = false }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  // Siempre la última versión de los avisos, sin recrear el editor.
  const avisos = useRef({ alCambiar, alEnfocar });
  avisos.current = { alCambiar, alEnfocar };

  useEffect(() => {
    if (!caja.current) return;
    const editor = new EditorView({
      parent: caja.current,
      state: EditorState.create({
        doc: valor,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          lenguajeMarkdown,
          EditorView.lineWrapping,
          placeholder('Escribe en Markdown…'),
          EditorView.contentAttributes.of({
            'aria-label': 'Contenido',
            autocapitalize: 'sentences',
            autocorrect: 'on',
            spellcheck: 'true',
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) avisos.current.alCambiar(u.state.doc.toString());
            if (u.focusChanged) avisos.current.alEnfocar?.(u.view.hasFocus);
          }),
        ],
      }),
    });
    if (vista) vista.current = editor;
    if (enfocarAlAbrir) editor.focus();
    return () => {
      if (editor.hasFocus) avisos.current.alEnfocar?.(false);
      if (vista) vista.current = null;
      editor.destroy();
    };
    // El editor se crea una vez por nota; `valor` solo es el texto inicial.
  }, []);

  return <div class="editor-markdown" ref={caja} />;
}
