import type { Categoria } from './categorias';
import { Icono, type NombreIcono } from './Icono';
import './categorias.css';
import './Cifra.css';

interface Props {
  etiqueta: string;
  /** Valor ya formateado ("$ 1.250.000", "38") */
  valor: string;
  /** Variación ya formateada ("+12 %", "−$ 20.000") */
  variacion?: string | undefined;
  tendencia?: 'sube' | 'baja' | 'igual' | undefined;
  /** Si subir es bueno (ventas) o malo (gastos): decide verde o rojo. Por defecto, subir es bueno. */
  subirEsBueno?: boolean | undefined;
  /** Texto pequeño bajo la variación ("frente a ayer") */
  detalle?: string | undefined;
  icono?: NombreIcono | undefined;
  color?: Categoria | undefined;
}

/** Tarjeta de indicador: etiqueta, número grande con cifras tabulares y variación con flecha. */
export function Cifra({ etiqueta, valor, variacion, tendencia = 'igual', subirEsBueno = true, detalle, icono, color = 'indigo' }: Props) {
  const bueno = tendencia === 'igual' ? null : (tendencia === 'sube') === subirEsBueno;
  const tono = bueno === null ? 'neutra' : bueno ? 'buena' : 'mala';
  const palabra = tendencia === 'sube' ? 'sube' : tendencia === 'baja' ? 'baja' : 'sin cambio';
  return (
    <section class={`cifra cat-${color}`} aria-label={etiqueta}>
      <div class="cifra__cabeza">
        {icono && (
          <span class="cifra__icono" aria-hidden="true">
            <Icono nombre={icono} tamano={20} />
          </span>
        )}
        <p class="cifra__etiqueta">{etiqueta}</p>
      </div>
      <p class="cifra__valor cifras">{valor}</p>
      {variacion && (
        <p class={`cifra__variacion cifra__variacion--${tono}`}>
          {tendencia !== 'igual' && <Icono nombre={tendencia} tamano={18} />}
          <span class="solo-lector">{palabra}: </span>
          <span class="cifras">{variacion}</span>
          {detalle && <span class="cifra__detalle"> {detalle}</span>}
        </p>
      )}
    </section>
  );
}
