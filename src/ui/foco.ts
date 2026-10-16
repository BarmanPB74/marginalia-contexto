import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Elementos que reciben foco con Tab dentro de `raiz`, en orden. */
export function enfocables(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => !el.hasAttribute('inert'));
}

/**
 * Foco atrapado para ventanas modales (Dialogo, Hoja): Tab y Mayús+Tab dan la vuelta dentro,
 * Escape llama a `alEscapar` y, al cerrar, el foco vuelve a donde estaba.
 */
export function useFocoAtrapado(
  ref: RefObject<HTMLElement | null>,
  alEscapar: () => void,
  inicial?: RefObject<HTMLElement | null>,
) {
  // Siempre la última función, sin volver a montar el efecto (que robaría el foco)
  const escapar = useRef(alEscapar);
  escapar.current = alEscapar;
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (inicial?.current ?? ref.current)?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      const raiz = ref.current;
      if (!raiz) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        escapar.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = enfocables(raiz);
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!primero || !ultimo) {
        e.preventDefault();
        return;
      }
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === raiz)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      } else if (!raiz.contains(activo)) {
        e.preventDefault();
        primero.focus();
      }
    };
    addEventListener('keydown', alTeclear);
    return () => {
      removeEventListener('keydown', alTeclear);
      if (previo?.isConnected) previo.focus();
    };
  }, [ref, inicial]);
}
