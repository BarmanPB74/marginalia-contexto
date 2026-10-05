import { useEffect, useState } from 'preact/hooks';
import type { Nota } from '../../core/notas/nota';
import { arbol, type NodoArbol } from '../../core/notas/repositorio';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';
import { useRepositorio } from './contexto';
import { SelectorPlantilla } from './SelectorPlantilla';
import './PantallaNotas.css';

interface Fila {
  nota: Nota;
  nivel: number;
}

function aplanar(nodos: NodoArbol[], nivel = 0): Fila[] {
  return nodos.flatMap((n) => [{ nota: n.nota, nivel }, ...aplanar(n.hijas, nivel + 1)]);
}

type Carga = { estado: 'cargando' } | { estado: 'error' } | { estado: 'listo'; filas: Fila[]; danadas: number };

/** Lista de páginas en árbol: título manuscrito y sangría por nivel. */
export function PantallaNotas() {
  const repo = useRepositorio();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => {
    let vigente = true;
    repo.listar().then(
      ({ notas, danadas }) =>
        vigente && setCarga({ estado: 'listo', filas: aplanar(arbol(notas)), danadas: danadas.length }),
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
  return (
    <Pagina>
      <Encabezado titulo="Notas" {...(accion ? { accion } : {})} />
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
      {carga.estado === 'listo' && carga.filas.length === 0 && !eligiendo && (
        <EstadoVacio mensaje="Aún no hay notas." pista="Toca «Nueva» para escribir la primera." />
      )}
      {carga.estado === 'listo' && carga.filas.length > 0 && (
        <ul class="lista-notas">
          {carga.filas.map(({ nota, nivel }) => (
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
