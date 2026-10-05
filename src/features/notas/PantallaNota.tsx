import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Nota } from '../../core/notas/nota';
import { Boton } from '../../ui/Boton';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Icono } from '../../ui/Icono';
import { Pagina } from '../../ui/Pagina';
import { useRepositorio } from './contexto';
import { BarraFormato } from './editor/BarraFormato';
import { EditorMarkdown } from './editor/EditorMarkdown';
import { Lectura } from './Lectura';
import { SelectorPlantilla } from './SelectorPlantilla';
import './PantallaNota.css';

/** Tras dejar de escribir, cuánto esperar antes de guardar. */
export const ESPERA_GUARDADO = 600;

type Guardado = 'guardado' | 'pendiente' | 'error';
type Modo = 'leer' | 'editar';

/** Recién creada o vacía → a escribir; si ya tiene cambios → a leer. */
function modoInicial(n: Nota): Modo {
  return n.creado === n.editado || !n.cuerpo.trim() ? 'editar' : 'leer';
}

/**
 * Una página abierta: título y cuerpo con autoguardado.
 * Leer/Editar con un toque; mientras se escribe, barra de formato sobre el teclado.
 */
export function PantallaNota({ id }: { id: string }) {
  const repo = useRepositorio();
  const [nota, setNota] = useState<Nota | null | undefined>(undefined);
  const [madre, setMadre] = useState<Nota | null>(null);
  const [guardado, setGuardado] = useState<Guardado>('guardado');
  const [eligiendo, setEligiendo] = useState(false);
  const [modo, setModo] = useState<Modo>('editar');
  const [escribiendo, setEscribiendo] = useState(false);
  const vista = useRef<EditorView | null>(null);
  const actual = useRef<Nota | null>(null);
  const sucia = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function guardarYa() {
    clearTimeout(temporizador.current);
    const n = actual.current;
    if (!n || !sucia.current) return;
    sucia.current = false;
    try {
      await repo.guardar(n);
      if (!sucia.current) setGuardado('guardado');
    } catch {
      sucia.current = true;
      setGuardado('error');
    }
  }

  useEffect(() => {
    let vigente = true;
    repo.obtener(id).then(
      async (n) => {
        if (!vigente) return;
        actual.current = n;
        if (n) setModo(modoInicial(n));
        setNota(n);
        const m = n?.padre ? await repo.obtener(n.padre) : null;
        if (vigente) setMadre(m);
      },
      () => vigente && setNota(null),
    );
    // Guardar lo pendiente al salir de la nota o si Android manda la app a segundo plano.
    const alOcultar = () => document.visibilityState === 'hidden' && void guardarYa();
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      vigente = false;
      document.removeEventListener('visibilitychange', alOcultar);
      void guardarYa();
    };
  }, [repo, id]);

  // Mientras se escribe se esconden la barra de secciones y el mini reproductor (BarraFormato.css).
  useEffect(() => {
    document.documentElement.classList.toggle('escribiendo', escribiendo);
    return () => document.documentElement.classList.remove('escribiendo');
  }, [escribiendo]);

  function cambiar(parcial: Pick<Nota, 'titulo'> | Pick<Nota, 'cuerpo'>) {
    if (!actual.current) return;
    const nueva = { ...actual.current, ...parcial };
    actual.current = nueva;
    sucia.current = true;
    setNota(nueva);
    setGuardado('pendiente');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void guardarYa(), ESPERA_GUARDADO);
  }

  async function crearSubpagina(plantilla: string) {
    await guardarYa();
    const hija = await repo.crear({ plantilla, padre: id });
    location.hash = `#/notas/${hija.id}`;
  }

  async function borrar() {
    if (!nota || !confirm(`¿Borrar «${nota.titulo}»? Sus subpáginas pasan al nivel de arriba.`)) return;
    clearTimeout(temporizador.current);
    sucia.current = false;
    actual.current = null;
    await repo.borrar(id);
    // replace: que "atrás" no vuelva a una nota que ya no existe
    location.replace(nota.padre ? `#/notas/${nota.padre}` : '#/notas');
  }

  if (nota === undefined) return <Pagina>{null}</Pagina>;
  if (nota === null) {
    return (
      <Pagina>
        <EstadoVacio mensaje="Esta nota no existe." pista="Puede que se haya borrado." />
        <p class="nota__volver">
          <a href="#/notas">Volver a Notas</a>
        </p>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <div class="nota__arriba">
        <button
          type="button"
          class="nota__volver-boton"
          aria-label="Volver"
          // Sube un nivel: a la página madre o a la lista
          onClick={() => (location.hash = nota.padre ? `#/notas/${nota.padre}` : '#/notas')}
        >
          <Icono nombre="atras" />
        </button>
        <nav class="nota__ruta" aria-label="Ubicación">
          <a href="#/notas">Notas</a>
          {madre && (
            <>
              {' / '}
              <a href={`#/notas/${madre.id}`}>{madre.titulo}</a>
            </>
          )}
        </nav>
        <Boton
          variante="texto"
          alTocar={() => {
            setEscribiendo(false);
            setModo(modo === 'leer' ? 'editar' : 'leer');
          }}
        >
          {modo === 'leer' ? 'Editar' : 'Leer'}
        </Boton>
      </div>
      <header class="nota__encabezado">
        <input
          class="nota__titulo"
          aria-label="Título"
          value={nota.titulo}
          placeholder="Sin título"
          onInput={(e) => cambiar({ titulo: e.currentTarget.value })}
        />
      </header>
      {modo === 'editar' ? (
        <EditorMarkdown
          valor={nota.cuerpo}
          alCambiar={(cuerpo) => cambiar({ cuerpo })}
          alEnfocar={setEscribiendo}
          vista={vista}
          enfocarAlAbrir
        />
      ) : (
        <Lectura texto={nota.cuerpo} />
      )}
      {modo === 'editar' && escribiendo && <BarraFormato vista={vista} />}
      <footer class="nota__pie">
        <span class="nota__estado" role="status">
          {guardado === 'pendiente' ? 'Guardando…' : guardado === 'error' ? 'No se pudo guardar' : 'Guardado'}
        </span>
        <span class="nota__acciones">
          <Boton variante="texto" alTocar={() => setEligiendo(true)}>
            Subpágina
          </Boton>
          <Boton variante="texto" alTocar={() => void borrar()}>
            Borrar nota
          </Boton>
        </span>
      </footer>
      {eligiendo && (
        <SelectorPlantilla
          titulo="Nueva subpágina desde…"
          alElegir={(p) => void crearSubpagina(p)}
          alCancelar={() => setEligiendo(false)}
        />
      )}
    </Pagina>
  );
}
