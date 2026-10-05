import { useEffect, useRef, useState } from 'preact/hooks';
import { cancionDeNota } from '../../core/musica/etiqueta';
import { extracto, haceCuanto } from '../../core/notas/extracto';
import type { Nota } from '../../core/notas/nota';
import './Recientes.css';

interface Props {
  notas: readonly Nota[];
  /** título de la página madre, para mostrar dónde vive cada nota */
  madreDe: (nota: Nota) => string | undefined;
}

/**
 * Notas como las apps recientes de Android: tarjetas grandes en fila, la última editada primero.
 * Se desliza de lado y cada tarjeta encaja en el centro; la del centro se ve completa y las de
 * los lados, un poco más pequeñas (animación ligada al desplazamiento, sin JavaScript por cuadro).
 */
export function Recientes({ notas, madreDe }: Props) {
  const fila = useRef<HTMLUListElement>(null);
  const [actual, setActual] = useState(0);
  const ordenadas = [...notas].sort((a, b) => (a.editado < b.editado ? 1 : a.editado > b.editado ? -1 : 0));

  // Contador "2 / 7": qué tarjeta está más cerca del centro.
  useEffect(() => {
    const lista = fila.current;
    if (!lista) return;
    const alDesplazar = () => {
      const tarjetas = [...lista.children] as HTMLElement[];
      const centro = lista.scrollLeft + lista.clientWidth / 2;
      let mejor = 0;
      let distancia = Infinity;
      tarjetas.forEach((t, i) => {
        const d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - centro);
        if (d < distancia) [mejor, distancia] = [i, d];
      });
      setActual(mejor);
    };
    lista.addEventListener('scroll', alDesplazar, { passive: true });
    return () => lista.removeEventListener('scroll', alDesplazar);
  }, []);

  return (
    <section class="recientes" aria-label="Notas recientes">
      <ul ref={fila} class="recientes__fila">
        {ordenadas.map((nota, i) => {
          const madre = madreDe(nota);
          const vista = extracto(nota.cuerpo);
          const cancion = cancionDeNota(nota);
          return (
            <li key={nota.id} class="recientes__hueco" style={{ '--orden': Math.min(i, 6) }}>
              <a class="recientes__tarjeta" href={`#/notas/${nota.id}`} aria-label={nota.titulo}>
                <span class="recientes__cabeza">
                  <span class="recientes__titulo">{nota.titulo}</span>
                  <span class="recientes__fecha">
                    {madre ? `${madre} · ` : ''}
                    {haceCuanto(nota.editado)}
                  </span>
                  {cancion && <span class="recientes__cancion">♪ {cancion.titulo ?? 'Canción'}</span>}
                </span>
                <span class="recientes__vista" aria-hidden="true">
                  {vista || 'Nota vacía'}
                </span>
                {nota.etiquetas.length > 0 && (
                  <span class="recientes__etiquetas" aria-hidden="true">
                    {nota.etiquetas.slice(0, 3).map((e) => (
                      <span key={e} class="recientes__etiqueta">
                        #{e}
                      </span>
                    ))}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      {ordenadas.length > 1 && (
        <p class="recientes__contador" aria-hidden="true">
          {actual + 1} / {ordenadas.length}
        </p>
      )}
    </section>
  );
}
