import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { lenguajeMarkdown } from './lenguaje';
import { fuenteEtiquetas, fuenteFechas } from './sugerencias';
import './EditorMarkdown.css';

interface Props {
  /** Texto inicial. Para cambiar de nota se monta otro editor (key). */
  valor: string;
  alCambiar: (valor: string) => void;
  alEnfocar?: (enfocado: boolean) => void;
  /** Para que la barra de formato actúe sobre este editor. */
  vista?: RefObject<EditorView | null>;
  enfocarAlAbrir?: boolean;
  /** Etiquetas que ya existen, para autocompletar `#` */
  etiquetas?: () => readonly string[];
  /** «Elegir en el calendario…» del autocompletar de `@`: el rango que hay que reemplazar */
  alElegirFecha?: (desde: number, hasta: number) => void;
}

/** Editor Markdown (CodeMirror 6): lienzo casi vacío, sin números de línea ni bordes. */
export function EditorMarkdown({
  valor,
  alCambiar,
  alEnfocar,
  vista,
  enfocarAlAbrir = false,
  etiquetas = () => [],
  alElegirFecha,
}: Props) {
  const caja = useRef<HTMLDivElement>(null);
  // Siempre la última versión de los avisos, sin recrear el editor.
  const avisos = useRef({ alCambiar, alEnfocar, etiquetas, alElegirFecha });
  avisos.current = { alCambiar, alEnfocar, etiquetas, alElegirFecha };

  useEffect(() => {
    if (!caja.current) return;
    const editor = new EditorView({
      parent: caja.current,
      state: EditorState.create({
        doc: valor,
        extensions: [
          history(),
          // `#` sugiere etiquetas que ya existen y `@` fechas cercanas (F3)
          autocompletion({
            override: [
              fuenteEtiquetas(() => avisos.current.etiquetas()),
              fuenteFechas(
                () => new Date(),
                (desde, hasta) => avisos.current.alElegirFecha?.(desde, hasta),
              ),
            ],
            icons: false,
            closeOnBlur: true,
            tooltipClass: () => 'sugerencias',
          }),
          keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
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
