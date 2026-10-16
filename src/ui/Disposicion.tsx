import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Boton } from './Boton';
import { Hoja } from './Hoja';
import './Disposicion.css';

interface Props {
  /** Filtros (u otro panel de apoyo). Se dibuja al lado (≥ 840 px) o dentro de una hoja inferior. */
  panel: ComponentChildren;
  /** Título del panel y del botón que lo abre */
  tituloPanel?: string | undefined;
  /** Cuántos filtros hay activos: aparece en el botón «Filtros (n)» */
  activos?: number | undefined;
  /** Pie del panel (p. ej. «Aplicar filtros (128)»); en la hoja queda fijo abajo */
  piePanel?: ComponentChildren | undefined;
  /** Contenido principal (chips activos, rejilla, tabla…) */
  children: ComponentChildren;
  /** Acciones junto al botón de filtros en compacto (ordenar, vista…) */
  barra?: ComponentChildren | undefined;
}

/**
 * Página de dos zonas como la referencia: panel lateral de filtros + contenido.
 * - Expandido (≥ 840 px): el panel es una columna fija a la izquierda, con su propio desplazamiento.
 * - Compacto y medio (< 840 px): el panel se esconde y un botón «Filtros (n)» lo abre en una Hoja.
 * Solo CSS decide qué se ve; la hoja se monta al pedirla.
 */
export function Disposicion({ panel, tituloPanel = 'Filtros', activos = 0, piePanel, children, barra }: Props) {
  const [abierta, setAbierta] = useState(false);
  const textoBoton = activos > 0 ? `${tituloPanel} (${activos})` : tituloPanel;
  return (
    <div class="disposicion">
      <aside class="disposicion__panel" aria-label={tituloPanel}>
        <h2 class="disposicion__titulo">{tituloPanel}</h2>
        <div class="disposicion__filtros">{panel}</div>
        {piePanel && <div class="disposicion__pie">{piePanel}</div>}
      </aside>
      <div class="disposicion__contenido">
        <div class="disposicion__barra">
          <span class="disposicion__abrir">
            <Boton icono="filtros" alTocar={() => setAbierta(true)}>
              {textoBoton}
            </Boton>
          </span>
          {barra}
        </div>
        {children}
      </div>
      {abierta && (
        <Hoja titulo={tituloPanel} alCerrar={() => setAbierta(false)} pie={piePanel}>
          <div class="disposicion__filtros">{panel}</div>
        </Hoja>
      )}
    </div>
  );
}

interface PropsRejilla {
  children: ComponentChildren;
  /** producto: tarjetas de producto (2 columnas en 360 px) · cifra: indicadores (más anchos) */
  tipo?: 'producto' | 'cifra' | undefined;
  /** Nombre de la zona para lectores de pantalla (la convierte en región) */
  etiqueta?: string | undefined;
}

/** Rejilla adaptable: tantas columnas como quepan (repeat(auto-fill, minmax(…))). */
export function Rejilla({ children, tipo = 'producto', etiqueta }: PropsRejilla) {
  return (
    <div class={`rejilla rejilla--${tipo}`} role={etiqueta ? 'region' : undefined} aria-label={etiqueta}>
      {children}
    </div>
  );
}
