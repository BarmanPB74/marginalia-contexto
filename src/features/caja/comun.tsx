import { useState } from 'preact/hooks';
import {
  leerDinero,
  mostrarCantidad,
  NumeroInvalido,
  ReglaRota,
  type Centavos,
  type FormaPago,
  type Milesimas,
  type Unidad,
} from '../../core/negocio';
import { CampoNumero } from '../../ui/CampoNumero';
import { TecladoNumerico } from '../../ui/TecladoNumerico';
import './comun.css';

/**
 * Piezas compartidas por Inicio, Vender y Caja (agente «ventas-caja»).
 * Nada de cuentas aquí: los totales los hace el núcleo; esto sólo muestra y lee texto.
 */

/** Mensaje para la persona. Las reglas del núcleo (y los números mal escritos) ya vienen en español. */
export function textoError(e: unknown): string {
  if (e instanceof ReglaRota || e instanceof NumeroInvalido) return e.message;
  return 'No se pudo guardar. Prueba otra vez.';
}

/** Ejecuta una operación del núcleo y guarda su error (o lo limpia). Evita el doble toque. */
export function useOperacion() {
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  async function correr(fn: () => Promise<unknown>): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    setError(undefined);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(textoError(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }
  return { error, setError, ocupado, correr };
}

/** Nombre corto de cada forma de pago (botones y tablas). El largo es `NOMBRE_FORMA`. */
export const FORMA_CORTA: Readonly<Record<FormaPago, string>> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  cortesia: 'Cortesía',
};

/** «10:42» a partir de la hora local guardada en el evento (ISO con desfase). */
export function hora(en: string): string {
  return en.slice(11, 16);
}

/** «16/10 · 22:15» */
export function fechaHora(en: string): string {
  return `${en.slice(8, 10)}/${en.slice(5, 7)} · ${hora(en)}`;
}

/** Unidad para mostrar junto a una cantidad. */
export function unidadCorta(u: Unidad): string {
  return u === 'unidad' ? 'und' : u;
}

export function cantidadCon(m: Milesimas, u: Unidad): string {
  return `${mostrarCantidad(m)} ${unidadCorta(u)}`;
}

/** Texto → centavos o `null` si está vacío. Lanza `NumeroInvalido` (en español) si está mal escrito. */
export function dineroOpcional(texto: string): Centavos | null {
  return texto.trim() === '' ? null : leerDinero(texto);
}

/** Lo mismo, pero sin lanzar: para vistas previas mientras se escribe. */
export function dineroSeguro(texto: string): Centavos | null {
  try {
    return dineroOpcional(texto);
  } catch {
    return null;
  }
}

interface PropsEntrada {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string | undefined;
  ayuda?: string | undefined;
  alConfirmar?: (() => void) | undefined;
  etiquetaConfirmar?: string | undefined;
  confirmarDesactivado?: boolean | undefined;
  /** Sin teclado en pantalla (p. ej. cuando ya hay otro visible) */
  sinTeclado?: boolean | undefined;
}

/**
 * Dinero con cifra grande y teclado de caja: se puede tocar el teclado o escribir en el campo
 * (teclado físico o el del teléfono). El texto lo valida el núcleo (`leerDinero`).
 */
export function EntradaDinero({ etiqueta, valor, alCambiar, error, ayuda, alConfirmar, etiquetaConfirmar, confirmarDesactivado, sinTeclado }: PropsEntrada) {
  return (
    <div class="entrada-dinero">
      <CampoNumero etiqueta={etiqueta} valor={valor} alCambiar={alCambiar} prefijo="$" grande error={error} ayuda={ayuda} alConfirmar={alConfirmar} />
      {!sinTeclado && (
        <TecladoNumerico
          valor={valor}
          alCambiar={alCambiar}
          etiqueta={`Teclado: ${etiqueta}`}
          alConfirmar={alConfirmar}
          etiquetaConfirmar={etiquetaConfirmar}
          confirmarDesactivado={confirmarDesactivado}
        />
      )}
    </div>
  );
}
