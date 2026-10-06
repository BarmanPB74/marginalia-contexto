import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useEstadoOpcional } from '../../app/estado';
import { diaDe } from '../../core/notas/fechas';
import { exportar, FORMATOS, nombreArchivo, type Formato } from '../../core/exportar/formatos';
import { guardarExportado } from '../../core/exportar/guardar';
import type { Nota } from '../../core/notas/nota';
import { claveEtiqueta, etiquetasDeNota } from '../../core/parser/parser';
import { Hoja } from '../../ui/Hoja';
import { SelectorFecha } from '../../ui/SelectorFecha';
import type { Comando } from '../comandos/comandos';
import { URI_SPOTIFY, cancionDeNota, enlaceCancion, idDe, minutoSegundo, rutaCancion } from '../../core/musica/etiqueta';
import { Boton } from '../../ui/Boton';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Icono } from '../../ui/Icono';
import { Pagina } from '../../ui/Pagina';
import { useRepositorio } from './contexto';
import { BarraFormato } from './editor/BarraFormato';
import { EditorMarkdown } from './editor/EditorMarkdown';
import { alternarLista, alternarNegrita, alternarTarea, insertarEnlace, insertarFecha } from './editor/formato';
import { Lectura } from './Lectura';
import { SelectorPlantilla } from './SelectorPlantilla';
import './PantallaNota.css';

/** Tras dejar de escribir, cuánto esperar antes de guardar. */
export const ESPERA_GUARDADO = 600;

type Guardado = 'guardado' | 'pendiente' | 'error';
type Modo = 'leer' | 'editar';

/** Recién creada o vacía → a escribir; si ya tiene cambios → a leer. */
function modoInicial(n: Nota, recienCreada: boolean): Modo {
  return recienCreada || !n.cuerpo.trim() ? 'editar' : 'leer';
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
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState('');
  /** Rango del editor donde va la fecha elegida en el selector (null = cerrado) */
  const [rangoFecha, setRangoFecha] = useState<{ desde: number; hasta: number } | null>(null);
  const etiquetasConocidas = useRef<string[]>([]);
  const vista = useRef<EditorView | null>(null);
  const actual = useRef<Nota | null>(null);
  const sucia = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const estado = useEstadoOpcional();
  // Lo que hacen los comandos de esta nota, siempre con el estado más reciente (sin volver a registrarlos en cada tecla)
  const acciones = useRef<Record<string, () => void | Promise<void>>>({});

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
        if (n) setModo(modoInicial(n, repo.tomarRecienCreada(n.id)));
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

  // Etiquetas de todas las notas, para autocompletar `#` en el editor
  useEffect(() => {
    let vigente = true;
    repo.listar().then(
      ({ notas }) => {
        if (!vigente) return;
        const vistas = new Map<string, string>();
        for (const e of notas.flatMap(etiquetasDeNota)) if (!vistas.has(claveEtiqueta(e))) vistas.set(claveEtiqueta(e), e);
        etiquetasConocidas.current = [...vistas.values()];
      },
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [repo]);

  function pedirFecha() {
    const editor = vista.current;
    if (!editor) return;
    const { from, to } = editor.state.selection.main;
    setRangoFecha({ desde: from, hasta: to });
  }

  /** ♪: lo que suena en la fuente elegida (YouTube o Spotify), en el segundo en que iba (historia 4). */
  function ponerCancion() {
    const editor = vista.current;
    const uriSpotify = estado?.spotify.estado?.uri;
    const enSpotify = estado?.fuente === 'spotify';
    const id = enSpotify
      ? uriSpotify && URI_SPOTIFY.test(uriSpotify) && estado?.spotify.conectado
        ? uriSpotify
        : null
      : (estado?.cancion?.enlace.video ?? null);
    if (!id) {
      estado?.avisar(
        enSpotify
          ? 'Conecta Spotify en Música y pon una canción: ♪ guardará el segundo en que va.'
          : 'Elige una canción en Música y vuelve: ♪ guardará el segundo en que iba.',
      );
      return;
    }
    if (!editor) return;
    const segundo = enSpotify ? (estado?.spotify.segundo() ?? 0) : (estado?.info.posicion ?? 0);
    const { from, to } = editor.state.selection.main;
    const antes = editor.state.sliceDoc(Math.max(0, from - 1), from);
    const texto = `${antes && !/\s/.test(antes) ? ' ' : ''}${enlaceCancion(id, segundo)} `;
    editor.dispatch({ changes: { from, to, insert: texto }, selection: { anchor: from + texto.length } });
    editor.focus();
  }

  function ponerFecha(dia: string) {
    const editor = vista.current;
    const rango = rangoFecha;
    setRangoFecha(null);
    if (!editor || !rango) return;
    editor.dispatch({ selection: { anchor: rango.desde, head: rango.hasta } });
    editor.dispatch(insertarFecha(editor.state, dia));
    editor.focus();
  }

  // Mientras se escribe se esconden la barra de secciones y el mini reproductor (BarraFormato.css).
  useEffect(() => {
    document.documentElement.classList.toggle('escribiendo', escribiendo);
    return () => document.documentElement.classList.remove('escribiendo');
  }, [escribiendo]);

  // Comandos de la paleta mientras esta nota está abierta.
  const setComandosLocales = estado?.setComandosLocales;
  const hayNota = Boolean(nota);
  useEffect(() => {
    if (!setComandosLocales || !hayNota) return;
    const de = (id: string, nombre: string, palabras: string, icono?: Comando['icono']): Comando => ({
      id,
      nombre,
      grupo: 'Esta nota',
      palabras,
      ...(icono ? { icono } : {}),
      ejecutar: () => acciones.current[id]?.(),
    });
    const lista: Comando[] = [
      de('alternar-modo', modo === 'leer' ? 'Editar esta nota' : 'Leer esta nota', 'modo lectura escritura'),
      de('fecha-hoy', 'Insertar la fecha de hoy', 'calendario dia @', 'calendario'),
      ...(modo === 'editar'
        ? [
            de('fecha-elegir', 'Insertar una fecha…', 'calendario dia @ elegir selector', 'calendario'),
            de('cancion', 'Insertar la canción que sonaba ♪', 'musica youtube segundo etiqueta', 'musica'),
          ]
        : []),
      de('subpagina', 'Nueva subpágina', 'crear hija pagina', 'mas'),
      ...FORMATOS.map((f) =>
        de(`exportar-${f.id}`, `Exportar esta nota como ${f.nombre}`, 'guardar compartir descifrar archivo', 'exportar'),
      ),
      de('borrar', 'Borrar esta nota', 'eliminar quitar papelera'),
    ];
    if (modo === 'editar') {
      lista.push(
        de('negrita', 'Negrita', 'formato resaltar'),
        de('lista', 'Lista', 'formato viñetas', 'lista'),
        de('tarea', 'Tarea', 'formato casilla pendiente'),
        de('enlace', 'Enlace', 'formato link url'),
      );
    }
    setComandosLocales(lista);
    return () => setComandosLocales([]);
  }, [setComandosLocales, hayNota, modo]);

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

  function enEditor(accion: (e: EditorView['state']) => Parameters<EditorView['dispatch']>[0]) {
    const editor = vista.current;
    if (!editor) return;
    editor.dispatch(accion(editor.state));
    editor.focus();
  }

  async function exportarComo(formato: Formato) {
    setExportando(false);
    await guardarYa();
    const n = actual.current;
    const f = FORMATOS.find((x) => x.id === formato);
    if (!n || !f) return;
    try {
      const donde = await guardarExportado(nombreArchivo(n.titulo, formato), exportar(n, formato), f.tipo);
      setAviso(`Exportada sin cifrar en ${donde}`);
    } catch {
      setAviso('No se pudo exportar. En Android 10 o anterior, la carpeta Documentos necesita un permiso que la app no pide.');
    }
  }

  acciones.current = {
    'exportar-md': () => exportarComo('md'),
    'exportar-txt': () => exportarComo('txt'),
    'exportar-html': () => exportarComo('html'),
    'alternar-modo': () => setModo((m) => (m === 'leer' ? 'editar' : 'leer')),
    'fecha-hoy': () => {
      const hoy = diaDe(new Date());
      if (modo === 'editar' && vista.current) enEditor((e) => insertarFecha(e, hoy));
      else if (actual.current) cambiar({ cuerpo: `${actual.current.cuerpo.trimEnd()}\n\n@${hoy}\n` });
    },
    'fecha-elegir': () => pedirFecha(),
    cancion: () => ponerCancion(),
    subpagina: () => setEligiendo(true),
    borrar: () => borrar(),
    negrita: () => enEditor(alternarNegrita),
    lista: () => enEditor(alternarLista),
    tarea: () => enEditor(alternarTarea),
    enlace: () => enEditor(insertarEnlace),
  };

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
      {(() => {
        const c = cancionDeNota(nota);
        if (!c) return null;
        return (
          <a class="nota__cancion" href={rutaCancion(idDe(c), c.t ?? 0)}>
            <span aria-hidden="true">♪</span>
            <span class="nota__cancion-texto">
              {c.titulo ?? 'Canción'}
              {c.artista ? ` · ${c.artista}` : ''}
            </span>
            {c.t !== undefined && <span class="nota__cancion-t">{minutoSegundo(c.t)}</span>}
          </a>
        );
      })()}
      {modo === 'editar' ? (
        <EditorMarkdown
          valor={nota.cuerpo}
          alCambiar={(cuerpo) => cambiar({ cuerpo })}
          alEnfocar={setEscribiendo}
          vista={vista}
          enfocarAlAbrir
          etiquetas={() => etiquetasConocidas.current}
          alElegirFecha={(desde, hasta) => setRangoFecha({ desde, hasta })}
        />
      ) : (
        <Lectura texto={nota.cuerpo} />
      )}
      {modo === 'editar' && escribiendo && <BarraFormato vista={vista} alPedirFecha={pedirFecha} alPonerCancion={ponerCancion} />}
      {rangoFecha && <SelectorFecha alElegir={ponerFecha} alCerrar={() => setRangoFecha(null)} />}
      <footer class="nota__pie">
        <span class="nota__estados">
          <span class="nota__estado" role="status">
            {guardado === 'pendiente' ? 'Guardando…' : guardado === 'error' ? 'No se pudo guardar' : 'Guardado'}
          </span>
          <span class="nota__cifrada" title="El archivo se guarda cifrado en este teléfono">
            <Icono nombre="candado" tamano={16} />
            cifrada
          </span>
        </span>
        <span class="nota__acciones">
          <Boton variante="texto" alTocar={() => setExportando(true)}>
            Exportar
          </Boton>
          <Boton variante="texto" alTocar={() => setEligiendo(true)}>
            Subpágina
          </Boton>
          <Boton variante="texto" alTocar={() => void borrar()}>
            Borrar nota
          </Boton>
        </span>
      </footer>
      {aviso && (
        <p class="nota__aviso" aria-live="polite">
          {aviso}
        </p>
      )}
      {exportando && (
        <Hoja titulo="Exportar sin cifrar" alCerrar={() => setExportando(false)}>
          <p class="nota__pista">
            La copia se guarda descifrada, para abrirla con cualquier app. La nota de aquí sigue cifrada.
          </p>
          <ul class="nota__formatos">
            {FORMATOS.map((f) => (
              <li key={f.id}>
                <Boton variante="texto" alTocar={() => void exportarComo(f.id)}>
                  {f.nombre}
                </Boton>
              </li>
            ))}
          </ul>
        </Hoja>
      )}
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
