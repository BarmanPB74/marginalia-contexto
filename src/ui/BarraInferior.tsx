import { SECCIONES, type IdSeccion } from '../app/rutas';
import { Icono } from './Icono';
import './BarraInferior.css';

/**
 * Navegación principal: las 5 secciones de `SECCIONES` con icono y etiqueta. Son enlaces (#/…).
 * Solo CSS decide la forma: barra inferior en teléfonos (< 600 px) y riel lateral desde 600 px.
 */
export function BarraInferior({ actual }: { actual?: IdSeccion }) {
  return (
    <nav class="barra-inferior" aria-label="Secciones">
      {SECCIONES.map((s) => (
        <a
          key={s.id}
          class="barra-inferior__enlace"
          href={`#/${s.id}`}
          aria-current={s.id === actual ? 'page' : undefined}
        >
          <span class="barra-inferior__pastilla">
            <Icono nombre={s.icono} />
          </span>
          <span class="barra-inferior__etiqueta">{s.etiqueta}</span>
        </a>
      ))}
    </nav>
  );
}
