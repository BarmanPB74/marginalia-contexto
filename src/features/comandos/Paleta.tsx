import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useEstado } from '../../app/estado';
import { fragmento, puntuar } from '../../core/comandos/buscar';
import type { Nota } from '../../core/notas/nota';
import { Icono, type NombreIcono } from '../../ui/Icono';
import { useRepositorio } from '../notas/contexto';
import { comandosGlobales, type Comando } from './comandos';
import './Paleta.css';

interface Resultado {
  id: string;
  nombre: string;
  grupo: string;
  detalle?: string;
  icono: NombreIcono;
  puntos: number;
  ejecutar: () => void | Promise<void>;
}

const MAX_NOTAS = 8;
const MAX_COMANDOS = 14;
const ORDEN_GRUPOS = ['Esta nota', 'Notas', 'Herramientas', 'Ir a', 'Música', 'Ajustes'];

function deComando(c: Comando, consulta: string): Resultado | null {
  const puntos = Math.max(puntuar(consulta, c.nombre) * 2, puntuar(consulta, `${c.nombre} ${c.palabras ?? ''}`));
  if (puntos === 0) return null;
  return { id: c.id, nombre: c.nombre, grupo: c.grupo, icono: c.icono ?? 'derecha', puntos, ejecutar: c.ejecutar };
}

function deNota(n: Nota, consulta: string): Resultado | null {
  const enTitulo = puntuar(consulta, n.titulo);
  const enTexto = consulta.trim() ? puntuar(consulta, `${n.titulo} ${n.etiquetas.join(' ')} ${n.cuerpo}`) : 0;
  if (enTitulo === 0 && enTexto === 0) return null;
  return {
    id: `nota-${n.id}`,
    nombre: n.titulo,
    grupo: 'Notas',
    ...(enTitulo === 0 ? { detalle: fragmento(n.cuerpo, consulta) } : {}),
    icono: 'notas',
    puntos: enTitulo * 2 + enTexto,
    ejecutar: () => void (location.hash = `#/notas/${n.id}`),
  };
}

/**
 * Paleta de comandos: una sola caja para encontrar notas (por título o texto), herramientas,
 * ajustes y pantallas escribiendo su nombre. Flechas + Intro con teclado; un toque en el móvil.
 */
export function Paleta() {
  const estado = useEstado();
  const repo = useRepositorio();
  const [consulta, setConsulta] = useState('');
  const [notas, setNotas] = useState<Nota[]>([]);
  const [elegido, setElegido] = useState(0);
  const caja = useRef<HTMLInputElement>(null);
  const cerrar = () => estado.abrirComandos(false);

  useEffect(() => {
    caja.current?.focus();
    let vigente = true;
    repo.listar().then(
      ({ notas: n }) => vigente && setNotas(n),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [repo]);

  const resultados = useMemo(() => {
    const comandos = [...estado.comandosLocales, ...comandosGlobales({ ...estado, repo, ajustes: estado })]
      .map((c) => deComando(c, consulta))
      .filter((r): r is Resultado => r !== null);
    const deNotas = (
      consulta.trim()
        ? notas.map((n) => deNota(n, consulta)).filter((r): r is Resultado => r !== null)
        : // Sin escribir nada: las últimas editadas
          [...notas]
            .sort((a, b) => (a.editado < b.editado ? 1 : -1))
            .slice(0, 4)
            .map((n) => deNota(n, ''))
            .filter((r): r is Resultado => r !== null)
    )
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, MAX_NOTAS);
    const todos = [...comandos.sort((a, b) => b.puntos - a.puntos).slice(0, MAX_COMANDOS), ...deNotas];
    // Agrupados en un orden fijo; dentro de cada grupo, por puntuación
    return todos.sort(
      (a, b) =>
        (consulta.trim() ? 0 : ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo)) || b.puntos - a.puntos,
    );
  }, [consulta, notas, estado, repo]);

  useEffect(() => setElegido(0), [consulta]);

  async function ejecutar(r: Resultado | undefined) {
    if (!r) return;
    cerrar();
    await r.ejecutar();
  }

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowDown') setElegido((i) => Math.min(i + 1, resultados.length - 1));
    else if (e.key === 'ArrowUp') setElegido((i) => Math.max(i - 1, 0));
    else if (e.key === 'Enter') void ejecutar(resultados[elegido]);
    else return;
    e.preventDefault();
  }

  let grupoAnterior = '';
  return (
    <div class="paleta">
      <div class="paleta__velo" onClick={cerrar} aria-hidden="true" />
      <div class="paleta__panel" role="dialog" aria-modal="true" aria-label="Buscar y comandos">
        <div class="paleta__caja">
          <Icono nombre="buscar" />
          <input
            ref={caja}
            class="paleta__entrada"
            type="search"
            enterKeyHint="go"
            placeholder="Busca notas, ajustes o herramientas…"
            aria-label="Buscar"
            aria-controls="paleta-resultados"
            aria-activedescendant={resultados[elegido] ? `paleta-${resultados[elegido].id}` : undefined}
            value={consulta}
            onInput={(e) => setConsulta(e.currentTarget.value)}
            onKeyDown={alTeclear}
          />
        </div>
        <ul id="paleta-resultados" class="paleta__lista" role="listbox" aria-label="Resultados">
          {resultados.length === 0 && <li class="paleta__nada">Nada se llama así.</li>}
          {resultados.map((r, i) => {
            const cabecera = !consulta.trim() && r.grupo !== grupoAnterior ? r.grupo : null;
            grupoAnterior = r.grupo;
            return (
              <Fragment key={r.id}>
                {cabecera && (
                  <li key={`g-${cabecera}`} class="paleta__grupo" role="presentation">
                    {cabecera}
                  </li>
                )}
                <li
                  id={`paleta-${r.id}`}
                  class="paleta__opcion"
                  role="option"
                  aria-selected={i === elegido}
                  onClick={() => void ejecutar(r)}
                  onPointerMove={() => setElegido(i)}
                >
                  <span class="paleta__icono" aria-hidden="true">
                    <Icono nombre={r.icono} tamano={20} />
                  </span>
                  <span class="paleta__textos">
                    <span class="paleta__nombre">{r.nombre}</span>
                    {r.detalle && <span class="paleta__detalle">{r.detalle}</span>}
                  </span>
                  {consulta.trim() && <span class="paleta__tipo">{r.grupo}</span>}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
