import type { Categoria } from '../../ui/categorias';
import '../../ui/categorias.css';
import './GraficoBarras.css';

export interface Barra {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Valor ya formateado ("$ 17.000") */
  texto: string;
  color: Categoria;
}

/**
 * Barras horizontales en SVG propio, una por fila, con la paleta categórica (tokens).
 * Toda la figura es UNA imagen accesible (role="img") cuyo nombre lleva los datos; la tabla
 * equivalente va al lado (la pone quien lo usa). Las etiquetas son HTML para que crezcan con la
 * letra del sistema (200 %) sin salirse; el SVG solo dibuja la barra y se estira al ancho libre.
 */
export function GraficoBarras({ titulo, barras }: { titulo: string; barras: readonly Barra[] }) {
  const maximo = Math.max(0, ...barras.map((b) => b.valor));
  const total = barras.reduce((s, b) => s + Math.max(0, b.valor), 0);
  const porcentaje = (v: number) => (total > 0 ? Math.round((Math.max(0, v) / total) * 100) : 0);
  const descripcion = `${titulo}: ${barras.map((b) => `${b.etiqueta} ${b.texto} (${porcentaje(b.valor)} %)`).join('; ')}.`;
  return (
    <div class="grafico" role="img" aria-label={descripcion}>
      {barras.map((b) => {
        const ancho = maximo > 0 ? (Math.max(0, b.valor) / maximo) * 100 : 0;
        return (
          <div key={b.clave} class={`grafico__fila cat-${b.color}`}>
            <span class="grafico__etiqueta">{b.etiqueta}</span>
            <svg class="grafico__barra" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <rect class="grafico__pista" x="0" y="0" width="100" height="10" />
              {ancho > 0 && <rect class="grafico__valor" x="0" y="0" width={Math.max(ancho, 1)} height="10" />}
            </svg>
            <span class="grafico__cifra cifras">{b.texto}</span>
          </div>
        );
      })}
    </div>
  );
}
