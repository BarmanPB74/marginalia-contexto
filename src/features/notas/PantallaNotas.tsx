import { useEffect, useState } from 'preact/hooks';
import type { VistaNotas } from '../../app/ajustes';
import { useEstadoOpcional } from '../../app/estado';
import type { Nota } from '../../core/notas/nota';
import { arbol, type NodoArbol } from '../../core/notas/repositorio';
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
  | { estado: 'listo'; notas: Nota[]; filas: Fila[]; danadas: number };

/**
 * Notas en dos vistas: tarjetas (como las apps recientes de Android, por defecto en la app) o
 * lista en árbol con sangría por nivel. Sin <ProveedorEstado> (pruebas sueltas) usa la lista.
 */
export function PantallaNotas() {
  const repo = useRepositorio();
  const estado = useEstadoOpcional();
  const vista: VistaNotas = estado?.vistaNotas ?? 'lista';
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => {
    let vigente = true;
    repo.listar().then(
      ({ notas, danadas }) =>
        vigente && setCarga({ estado: 'listo', notas, filas: aplanar(arbol(notas)), danadas: danadas.length }),
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
  const titulos = carga.estado === 'listo' ? new Map(carga.notas.map((n) => [n.id, n.titulo])) : new Map<string, string>();
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
      {carga.estado === 'listo' && carga.filas.length === 0 && !eligiendo && (
        <EstadoVacio mensaje="Aún no hay notas." pista="Toca «Nueva» para escribir la primera." />
      )}
      {carga.estado === 'listo' && carga.filas.length > 0 && vista === 'tarjetas' && (
        <Recientes notas={carga.notas} madreDe={(n) => (n.padre ? titulos.get(n.padre) : undefined)} />
      )}
      {carga.estado === 'listo' && carga.filas.length > 0 && vista === 'lista' && (
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
