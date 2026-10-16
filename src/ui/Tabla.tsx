import type { ComponentChildren } from 'preact';
import './Tabla.css';

export interface Columna<F> {
  clave: string;
  titulo: string;
  celda: (fila: F) => ComponentChildren;
  /** Cifras alineadas a la derecha, tabulares */
  numerica?: boolean | undefined;
  /** La columna que nombra la fila: en compacto va arriba, como título de la tarjeta */
  principal?: boolean | undefined;
}

interface Props<F> {
  /** Título de la tabla (caption) */
  titulo: string;
  /** Mostrar el título (si no, solo para lectores de pantalla) */
  verTitulo?: boolean | undefined;
  columnas: readonly Columna<F>[];
  filas: readonly F[];
  claveFila: (fila: F) => string;
  /** Tocar una fila (abrir detalle) */
  alTocarFila?: ((fila: F) => void) | undefined;
  /** Texto cuando no hay filas */
  vacia?: string | undefined;
}

/**
 * Tabla adaptable. Ancha: tabla de verdad con cabecera. Estrecha (contenedor < 560 px): cada fila
 * se apila como una tarjeta con «Título: valor». Los roles ARIA explícitos mantienen la semántica
 * de tabla aunque el CSS cambie el `display`.
 */
export function Tabla<F>({ titulo, verTitulo = false, columnas, filas, claveFila, alTocarFila, vacia = 'Sin datos.' }: Props<F>) {
  return (
    <div class="tabla">
      <table class="tabla__tabla" role="table">
        <caption class={verTitulo ? 'tabla__titulo' : 'solo-lector'}>{titulo}</caption>
        <thead class="tabla__cabecera" role="rowgroup">
          <tr role="row">
            {columnas.map((c) => (
              <th key={c.clave} role="columnheader" scope="col" class={c.numerica ? 'tabla__num' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {filas.length === 0 ? (
            <tr role="row" class="tabla__fila tabla__fila--vacia">
              <td role="cell" colSpan={columnas.length}>
                {vacia}
              </td>
            </tr>
          ) : (
            filas.map((f) => (
              <tr key={claveFila(f)} role="row" class={`tabla__fila${alTocarFila ? ' tabla__fila--tocable' : ''}`}>
                {columnas.map((c) => (
                  <td
                    key={c.clave}
                    role="cell"
                    data-titulo={c.titulo}
                    class={[c.numerica && 'tabla__num cifras', c.principal && 'tabla__principal'].filter(Boolean).join(' ') || undefined}
                  >
                    {c.principal && alTocarFila ? (
                      <button type="button" class="tabla__abrir" onClick={() => alTocarFila(f)}>
                        {c.celda(f)}
                      </button>
                    ) : (
                      c.celda(f)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
