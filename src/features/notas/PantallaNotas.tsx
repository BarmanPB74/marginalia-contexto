import { useEffect, useMemo, useState } from 'preact/hooks';
import type { VistaNotas } from '../../app/ajustes';
import { useEstadoOpcional } from '../../app/estado';
import type { Nota } from '../../core/notas/nota';
import { arbol, type NodoArbol } from '../../core/notas/repositorio';
import { claveEtiqueta, etiquetasDeNota } from '../../core/parser/parser';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';
import { useRepositorio } from './contexto';
import { Recientes } from './Recientes';
import { SelectorPlantilla } from './SelectorPlantilla';
import './PantallaNotas.css';

interface Fila {
  nota: Nota;
  nivel: number;
}

function aplanar(nodos: NodoArbol[], nivel = 0): Fila[] {
  return nodos.flatMap((n) => [{ nota: n.nota, nivel }, ...aplanar(n.hijas, nivel + 1)]);
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; notas: Nota[]; danadas: number };

interface EtiquetaContada {
  nombre: string;
  cuantas: number;
}

/** Todas las etiquetas (frontmatter y texto), con cuántas notas las llevan; las más usadas primero. */
function contarEtiquetas(notas: readonly Nota[]): EtiquetaContada[] {
  const cuenta = new Map<string, EtiquetaContada>();
  for (const n of notas) {
    for (const e of etiquetasDeNota(n)) {
      const k = claveEtiqueta(e);
      const actual = cuenta.get(k);
      if (actual) actual.cuantas++;
      else cuenta.set(k, { nombre: e, cuantas: 1 });
    }
  }
  return [...cuenta.values()].sort((a, b) => b.cuantas - a.cuantas || a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Notas en dos vistas: tarjetas (como las apps recientes de Android, por defecto en la app) o
 * lista en árbol con sangría por nivel. Sin <ProveedorEstado> (pruebas sueltas) usa la lista.
 */
export function PantallaNotas({ etiqueta = null }: { etiqueta?: string | null }) {
  const repo = useRepositorio();
  const estado = useEstadoOpcional();
  const vista: VistaNotas = estado?.vistaNotas ?? 'lista';
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => {
    let vigente = true;
    repo.listar().then(
      ({ notas, danadas }) =>
        vigente && setCarga({ estado: 'listo', notas, danadas: danadas.length }),
      () => vigente && setCarga({ estado: 'error' }),
    );
    return () => {
      vigente = false;
    };
  }, [repo]);

  async function crear(plantilla: string) {
    const nota = await repo.crear({ plantilla });
    location.hash = `#/notas/${nota.id}`;
  }

  const accion = eligiendo ? undefined : { etiqueta: 'Nueva', alTocar: () => setEligiendo(true) };
  const iconos = estado
    ? [
        { icono: 'buscar' as const, etiqueta: 'Buscar y comandos', alTocar: () => estado.abrirComandos(true) },
        vista === 'tarjetas'
          ? { icono: 'lista' as const, etiqueta: 'Ver como lista', alTocar: () => estado.cambiarAjustes({ vistaNotas: 'lista' }) }
          : {
              icono: 'tarjetas' as const,
              etiqueta: 'Ver como tarjetas',
              alTocar: () => estado.cambiarAjustes({ vistaNotas: 'tarjetas' }),
            },
      ]
    : [];
  const todas = carga.estado === 'listo' ? carga.notas : [];
  const titulos = new Map(todas.map((n) => [n.id, n.titulo]));
  const etiquetas = useMemo(() => contarEtiquetas(todas), [todas]);
  const filtro = etiqueta ? claveEtiqueta(etiqueta) : null;
  const visibles = filtro ? todas.filter((n) => etiquetasDeNota(n).some((e) => claveEtiqueta(e) === filtro)) : todas;
  const filas = aplanar(arbol(visibles));
  const irA = (e: string | null) => (location.hash = e ? `#/notas?etiqueta=${encodeURIComponent(e)}` : '#/notas');
  return (
    <Pagina>
      <Encabezado titulo="Notas" iconos={iconos} {...(accion ? { accion } : {})} />
      {eligiendo && (
        <SelectorPlantilla
          titulo="Nueva nota desde…"
          alElegir={(p) => void crear(p)}
          alCancelar={() => setEligiendo(false)}
        />
      )}
      {carga.estado === 'error' && (
        <EstadoVacio
          mensaje="No se pudieron leer las notas."
          pista="Cierra y vuelve a abrir la app. Tus archivos no se han tocado."
        />
      )}
      {carga.estado === 'listo' && etiquetas.length > 0 && (
        <nav class="filtro-etiquetas" aria-label="Filtrar por etiqueta">
          <button type="button" class="filtro-etiquetas__chip" aria-pressed={!filtro} onClick={() => irA(null)}>
            Todas
          </button>
          {etiquetas.map((e) => (
            <button
              key={e.nombre}
              type="button"
              class="filtro-etiquetas__chip"
              aria-pressed={claveEtiqueta(e.nombre) === filtro}
              onClick={() => irA(claveEtiqueta(e.nombre) === filtro ? null : e.nombre)}
            >
              #{e.nombre}
              <span class="filtro-etiquetas__cuenta">{e.cuantas}</span>
            </button>
          ))}
        </nav>
      )}
      {carga.estado === 'listo' && todas.length === 0 && !eligiendo && (
        <EstadoVacio mensaje="Aún no hay notas." pista="Toca «Nueva» para escribir la primera." />
      )}
      {carga.estado === 'listo' && todas.length > 0 && filas.length === 0 && (
        <EstadoVacio mensaje={`Ninguna nota con #${etiqueta ?? ''}.`} pista="Toca «Todas» para verlas todas." />
      )}
      {carga.estado === 'listo' && filas.length > 0 && vista === 'tarjetas' && (
        <Recientes
          key={filtro ?? ''}
          notas={visibles}
          madreDe={(n) => (n.padre ? titulos.get(n.padre) : undefined)}
        />
      )}
      {carga.estado === 'listo' && filas.length > 0 && vista === 'lista' && (
        <ul class="lista-notas">
          {filas.map(({ nota, nivel }) => (
            <li key={nota.id} style={{ '--nivel': nivel }}>
              <a class="lista-notas__enlace" href={`#/notas/${nota.id}`}>
                {nota.titulo}
              </a>
            </li>
          ))}
        </ul>
      )}
      {carga.estado === 'listo' && carga.danadas > 0 && (
        <p class="lista-notas__aviso">
          {carga.danadas === 1 ? '1 archivo no se pudo leer' : `${carga.danadas} archivos no se pudieron leer`}; se
          dejaron sin tocar.
        </p>
      )}
    </Pagina>
  );
}
