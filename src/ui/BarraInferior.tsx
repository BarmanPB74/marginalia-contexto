import { SECCIONES, type IdSeccion } from '../app/rutas';
import { Icono } from './Icono';
import './BarraInferior.css';

/** Navegación principal: 4 secciones con icono y etiqueta manuscrita. Son enlaces (#/…), no botones. */
export function BarraInferior({ actual }: { actual: IdSeccion }) {
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
