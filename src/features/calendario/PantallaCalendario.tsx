import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useEstadoOpcional } from '../../app/estado';
import {
  cuadriculaMes,
  diaDe,
  diaLargo,
  nombreMes,
  notasPorDia,
  type Dia,
} from '../../core/notas/fechas';
import type { Nota } from '../../core/notas/nota';
import { Boton } from '../../ui/Boton';
import { CeldaDia } from '../../ui/CeldaDia';
import { Encabezado } from '../../ui/Encabezado';
import { Hoja } from '../../ui/Hoja';
import { Icono } from '../../ui/Icono';
import { Pagina } from '../../ui/Pagina';
import { useRepositorio } from '../notas/contexto';
import './PantallaCalendario.css';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
/** Cuánto hay que deslizar la cuadrícula para cambiar de mes. */
const UMBRAL_GESTO = 60;

interface Mes {
  anio: number;
  mes: number;
}

function mesDe(dia: Dia): Mes {
  const [anio, mes] = dia.split('-').map(Number) as [number, number];
  return { anio, mes: mes - 1 };
}

function sumarMeses({ anio, mes }: Mes, n: number): Mes {
  const fecha = new Date(anio, mes + n, 1);
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() };
}

/**
 * Vista de mes (lunes primero, hoy resaltado). Cada nota con @fecha o `fecha:` deja una raya en su día.
 * Tocar un día abre una hoja con sus notas y para crear la bitácora de ese día.
 * El día abierto vive en la ruta (#/calendario/AAAA-MM-DD): "atrás" cierra la hoja y los enlaces @fecha llegan aquí.
 */
export function PantallaCalendario({ dia = null, hoy = diaDe(new Date()) }: { dia?: Dia | null; hoy?: Dia }) {
  const repo = useRepositorio();
  const estado = useEstadoOpcional();
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [mes, setMes] = useState<Mes>(() => mesDe(dia ?? hoy));
  const [direccion, setDireccion] = useState<'antes' | 'despues' | null>(null);
  const gesto = useRef<number | null>(null);

  useEffect(() => {
    let vigente = true;
    repo.listar().then(
      ({ notas: n }) => vigente && setNotas(n),
      () => vigente && setNotas([]),
    );
    return () => {
      vigente = false;
    };
  }, [repo]);

  // Un enlace @fecha de otro mes: la cuadrícula salta a ese mes.
  useEffect(() => {
    if (dia) setMes(mesDe(dia));
  }, [dia]);

  const indice = useMemo(() => notasPorDia(notas ?? []), [notas]);
  const celdas = cuadriculaMes(mes.anio, mes.mes);
  const conNotas = celdas.filter((c) => !c.fuera && indice.has(c.dia));

  function cambiarMes(n: number) {
    setDireccion(n > 0 ? 'despues' : 'antes');
    setMes((m) => sumarMeses(m, n));
  }

  function abrir(d: Dia) {
    location.hash = `#/calendario/${d}`;
  }

  function cerrar() {
    location.replace('#/calendario');
  }

  async function crear(plantilla: string, d: Dia) {
    const nota = await repo.crear({ plantilla, dia: d });
    location.hash = `#/notas/${nota.id}`;
  }

  const delDia = dia ? (indice.get(dia) ?? []) : [];

  return (
    <Pagina>
      <Encabezado
        titulo="Calendario"
        iconos={estado ? [{ icono: 'buscar', etiqueta: 'Buscar y comandos', alTocar: () => estado.abrirComandos(true) }] : []}
        accion={{
          etiqueta: 'Hoy',
          alTocar: () => {
            const actual = mesDe(hoy);
            setDireccion(actual.anio * 12 + actual.mes >= mes.anio * 12 + mes.mes ? 'despues' : 'antes');
            setMes(actual);
          },
        }}
      />
      <div class="calendario__mes">
        <button type="button" class="calendario__flecha" aria-label="Mes anterior" onClick={() => cambiarMes(-1)}>
          <Icono nombre="izquierda" />
        </button>
        <h2 class="calendario__nombre" aria-live="polite">
          {nombreMes(mes.anio, mes.mes)}
        </h2>
        <button type="button" class="calendario__flecha" aria-label="Mes siguiente" onClick={() => cambiarMes(1)}>
          <Icono nombre="derecha" />
        </button>
      </div>

      <div
        class="calendario__rejilla"
        role="group"
        aria-label={nombreMes(mes.anio, mes.mes)}
        onPointerDown={(e) => (gesto.current = e.clientX)}
        onPointerUp={(e) => {
          if (gesto.current === null) return;
          const dx = e.clientX - gesto.current;
          gesto.current = null;
          if (Math.abs(dx) >= UMBRAL_GESTO) cambiarMes(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (gesto.current = null)}
      >
        <div class="calendario__semana" aria-hidden="true">
          {DIAS_SEMANA.map((d) => (
            <span key={d} class="calendario__dia-semana">
              {d}
            </span>
          ))}
        </div>
        <div
          key={`${mes.anio}-${mes.mes}`}
          class={`calendario__dias${direccion ? ` calendario__dias--${direccion}` : ''}`}
        >
          {celdas.map((c) => (
            <span key={c.dia} class={c.dia === dia ? 'calendario__celda--elegida' : undefined}>
              <CeldaDia
                dia={c.numero}
                notas={indice.get(c.dia)?.length ?? 0}
                hoy={c.dia === hoy}
                fuera={c.fuera}
                alTocar={() => abrir(c.dia)}
              />
            </span>
          ))}
        </div>
      </div>

      {notas !== null && (
        <section class="calendario__agenda" aria-label="Agenda del mes">
          {conNotas.length === 0 ? (
            <p class="calendario__vacio">
              Ningún día marcado este mes. Toca un día para escribir su bitácora, o pon una @fecha en una nota.
            </p>
          ) : (
            <ul class="calendario__lista">
              {conNotas.map((c) => (
                <li key={c.dia}>
                  <a class="calendario__agenda-dia" href={`#/calendario/${c.dia}`}>
                    {diaLargo(c.dia)}
                  </a>
                  <ul>
                    {(indice.get(c.dia) ?? []).map((n) => (
                      <li key={n.id}>
                        <a class="calendario__nota" href={`#/notas/${n.id}`}>
                          {n.titulo}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {dia && (
        <Hoja titulo={diaLargo(dia)} alCerrar={cerrar}>
          {delDia.length > 0 ? (
            <ul class="calendario__lista calendario__lista--hoja">
              {delDia.map((n) => (
                <li key={n.id}>
                  <a class="calendario__nota" href={`#/notas/${n.id}`}>
                    {n.titulo}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p class="calendario__vacio">Sin notas este día.</p>
          )}
          <div class="calendario__crear">
            <Boton alTocar={() => void crear('bitacora', dia)}>Nueva bitácora</Boton>
            <Boton variante="texto" alTocar={() => void crear('reunion', dia)}>
              Reunión
            </Boton>
            <Boton variante="texto" alTocar={() => void crear('rapida', dia)}>
              Nota rápida
            </Boton>
          </div>
        </Hoja>
      )}
    </Pagina>
  );
}
