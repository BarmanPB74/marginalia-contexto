import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { Almacen } from '../../core/almacen/almacen';
import { Boton } from '../../ui/Boton';
import { Icono } from '../../ui/Icono';
import { almacenDeLaApp } from '../notas/contexto';
import {
  borrarAdjunto,
  ErrorAdjunto,
  esImagen,
  guardarAdjunto,
  leerAdjunto,
  leerBytes,
  MAX_ORIGEN,
  tamanoLegible,
  tipoPorFirma,
  type Adjunto,
  type Reductor,
  type TipoAdjunto,
} from './adjuntos';
import './adjuntos.css';

/** Almacén de los adjuntos. Las pruebas inyectan uno en memoria; si no, el cifrado de la app. */
export const AlmacenAdjuntos = createContext<Almacen | null>(null);
/** Reductor de imágenes inyectable (pruebas). */
export const ReductorAdjuntos = createContext<Reductor | null>(null);

export function useAlmacenAdjuntos(): Almacen {
  return useContext(AlmacenAdjuntos) ?? almacenDeLaApp();
}

/** Archivo elegido que aún no se guarda (se guarda al registrar la factura o el gasto). */
export interface ArchivoPendiente {
  readonly clave: string;
  readonly nombre: string;
  readonly tipo: TipoAdjunto;
  readonly bytes: Uint8Array;
}

/** Guarda los pendientes y devuelve sus ids. Si uno falla, borra los ya guardados y relanza. */
export function useGuardarAdjuntos() {
  const almacen = useAlmacenAdjuntos();
  const reducir = useContext(ReductorAdjuntos);
  return async (lista: readonly ArchivoPendiente[]): Promise<{ ids: string[]; deshacer: () => Promise<void> }> => {
    const ids: string[] = [];
    const deshacer = async () => {
      for (const id of ids) await borrarAdjunto(almacen, id).catch(() => undefined);
    };
    try {
      for (const a of lista) ids.push(await guardarAdjunto(almacen, a, reducir ? { reducir } : {}));
    } catch (e) {
      await deshacer();
      throw e;
    }
    return { ids, deshacer };
  };
}

const ACEPTA = 'image/*,application/pdf';
let contador = 0;

interface PropsSelector {
  archivos: readonly ArchivoPendiente[];
  alCambiar: (lista: ArchivoPendiente[]) => void;
  /** Cuántos se pueden adjuntar (factura: 10; gasto: 1) */
  maximo?: number;
  etiqueta?: string;
}

/**
 * Elegir foto o PDF: «Tomar foto» abre la cámara del sistema (`capture`, sin permiso de cámara
 * en la app) y «Elegir archivo» abre la galería o los documentos. Se valida por contenido al
 * elegir, para avisar enseguida; se guarda cifrado al registrar.
 */
export function SelectorAdjunto({ archivos, alCambiar, maximo = 10, etiqueta = 'Foto o PDF de la factura' }: PropsSelector) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const lleno = archivos.length >= maximo;

  async function elegidos(lista: FileList | null) {
    setError('');
    const nuevos: ArchivoPendiente[] = [];
    for (const f of Array.from(lista ?? [])) {
      if (archivos.length + nuevos.length >= maximo) {
        setError(maximo === 1 ? 'Solo se adjunta un archivo.' : `Máximo ${maximo} archivos.`);
        break;
      }
      if (f.size > MAX_ORIGEN) {
        setError('El archivo pesa más de 10 MB.');
        continue;
      }
      const bytes = await leerBytes(f);
      const tipo = tipoPorFirma(bytes);
      if (!tipo) {
        setError('Solo se aceptan fotos (JPEG, PNG o WebP) o PDF.');
        continue;
      }
      nuevos.push({ clave: `a${++contador}`, nombre: f.name, tipo, bytes });
    }
    if (nuevos.length) alCambiar([...archivos, ...nuevos]);
  }

  const entrada = (ref: typeof camara, conCamara: boolean, nombre: string) => (
    <input
      ref={ref}
      class="solo-lector"
      type="file"
      accept={ACEPTA}
      multiple={!conCamara && maximo > 1}
      {...(conCamara ? { capture: 'environment' } : {})}
      aria-label={nombre}
      tabIndex={-1}
      onChange={(e) => {
        const input = e.currentTarget;
        void elegidos(input.files).finally(() => (input.value = ''));
      }}
    />
  );

  return (
    <fieldset class="adjuntos">
      <legend class="adjuntos__leyenda">{etiqueta}</legend>
      {entrada(camara, true, 'Tomar foto')}
      {entrada(galeria, false, 'Elegir foto o PDF')}
      <div class="adjuntos__botones">
        <Boton icono="camara" desactivado={lleno} alTocar={() => camara.current?.click()}>
          Tomar foto
        </Boton>
        <Boton icono="adjunto" desactivado={lleno} alTocar={() => galeria.current?.click()}>
          Elegir archivo
        </Boton>
      </div>
      {error && (
        <p class="adjuntos__error" role="alert">
          {error}
        </p>
      )}
      {archivos.length > 0 && (
        <ul class="adjuntos__lista">
          {archivos.map((a) => (
            <li key={a.clave} class="adjuntos__item">
              <Miniatura bytes={a.bytes} tipo={a.tipo} />
              <span class="adjuntos__nombre">
                {a.nombre}
                <span class="adjuntos__tamano cifras">{tamanoLegible(a.bytes.length)}</span>
              </span>
              <button
                type="button"
                class="adjuntos__quitar"
                aria-label={`Quitar ${a.nombre}`}
                onClick={() => alCambiar(archivos.filter((x) => x.clave !== a.clave))}
              >
                <Icono nombre="cerrar" tamano={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/** URL `blob:` para unos bytes; se revoca al cambiar o desmontar. */
function useUrlBlob(bytes: Uint8Array | null, tipo: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!bytes || typeof URL.createObjectURL !== 'function') return;
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }));
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [bytes, tipo]);
  return url;
}

function Miniatura({ bytes, tipo }: { bytes: Uint8Array; tipo: TipoAdjunto }) {
  const url = useUrlBlob(esImagen(tipo) ? bytes : null, tipo);
  return (
    <span class="adjuntos__mini" aria-hidden="true">
      {url ? <img src={url} alt="" /> : <Icono nombre={esImagen(tipo) ? 'camara' : 'factura'} tamano={24} />}
    </span>
  );
}

type Carga = { tipo: 'cargando' } | { tipo: 'falta' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; adjunto: Adjunto };

/** Muestra un adjunto guardado: la imagen dentro de la ficha; un PDF se descarga. */
export function VisorAdjunto({ id, titulo = 'Adjunto' }: { id: string; titulo?: string }) {
  const almacen = useAlmacenAdjuntos();
  const [carga, setCarga] = useState<Carga>({ tipo: 'cargando' });
  useEffect(() => {
    let vigente = true;
    setCarga({ tipo: 'cargando' });
    leerAdjunto(almacen, id).then(
      (a) => vigente && setCarga(a ? { tipo: 'listo', adjunto: a } : { tipo: 'falta' }),
      (e: unknown) => vigente && setCarga({ tipo: 'error', mensaje: e instanceof ErrorAdjunto ? e.message : 'No se pudo abrir el adjunto.' }),
    );
    return () => {
      vigente = false;
    };
  }, [almacen, id]);
  const adjunto = carga.tipo === 'listo' ? carga.adjunto : null;
  const url = useUrlBlob(adjunto?.bytes ?? null, adjunto?.tipo ?? '');

  if (carga.tipo === 'cargando') return <p class="adjuntos__estado">Abriendo {titulo.toLowerCase()}…</p>;
  if (carga.tipo === 'falta') return <p class="adjuntos__estado">No se encontró el archivo en este teléfono.</p>;
  if (carga.tipo === 'error') return <p class="adjuntos__estado" role="alert">{carga.mensaje}</p>;
  const a = carga.adjunto;
  if (esImagen(a.tipo)) {
    return (
      <figure class="adjuntos__visor">
        {url && <img class="adjuntos__imagen" src={url} alt={`${titulo}: ${a.nombre}`} />}
        <figcaption class="adjuntos__pie">
          {a.nombre} · <span class="cifras">{tamanoLegible(a.tamano)}</span>
        </figcaption>
      </figure>
    );
  }
  return (
    <p class="adjuntos__pdf">
      <Icono nombre="factura" />
      <span class="adjuntos__nombre">
        {a.nombre}
        <span class="adjuntos__tamano cifras">{tamanoLegible(a.tamano)}</span>
      </span>
      {url && (
        <a class="boton boton--contorno" href={url} download={a.nombre}>
          <Icono nombre="exportar" tamano={20} />
          <span class="boton__texto">Descargar PDF</span>
        </a>
      )}
    </p>
  );
}
