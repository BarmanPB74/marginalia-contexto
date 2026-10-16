import type { ComponentChildren } from 'preact';
import { Icono, type NombreIcono } from './Icono';
import './Boton.css';

interface Props {
  children: ComponentChildren;
  /**
   * contorno: píldora elevada (secundaria, la de siempre) · texto: sin fondo ·
   * primario: píldora índigo, la acción principal de la pantalla (una sola) ·
   * tonal: píldora suave de primario · peligro: borrar, anular
   */
  variante?: 'contorno' | 'texto' | 'primario' | 'tonal' | 'peligro';
  alTocar?: () => void;
  desactivado?: boolean;
  /** Icono a la izquierda del texto */
  icono?: NombreIcono;
  /** Ocupa todo el ancho disponible */
  ancho?: boolean;
  /** «submit» dentro de un <form> */
  tipo?: 'button' | 'submit';
  /** Nombre accesible si el texto visible no basta */
  etiqueta?: string;
}

export function Boton({
  children,
  variante = 'contorno',
  alTocar,
  desactivado = false,
  icono,
  ancho = false,
  tipo = 'button',
  etiqueta,
}: Props) {
  return (
    <button
      type={tipo}
      class={`boton boton--${variante}${ancho ? ' boton--ancho' : ''}`}
      onClick={alTocar}
      disabled={desactivado}
      aria-label={etiqueta}
    >
      {icono && <Icono nombre={icono} tamano={20} />}
      <span class="boton__texto">{children}</span>
    </button>
  );
}
