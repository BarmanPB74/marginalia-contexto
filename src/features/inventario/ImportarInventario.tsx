import { useMemo, useRef, useState } from 'preact/hooks';
import { mostrarCantidad, milesimas, stockDe, type ResultadoImportacion } from '../../core/negocio';
import {
  buscarFilaEncabezado,
  detectarColumnas,
  filasImportables,
  letraColumna,
  listarColumnas,
  leerTabla,
  LIMITES,
  planImportacion,
  type AccionImportacion,
  type CampoImportable,
  type Convencion,
  type MapeoColumnas,
  type ModoImportacion,
  type ResultadoFilas,
  type Tabla as TablaDatos,
} from '../../core/negocio/importar';
import { useEstado } from '../../app/estado';
import { leerBytes } from '../adjuntos/adjuntos';
import { Boton } from '../../ui/Boton';
import { Cifra } from '../../ui/Cifra';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Icono } from '../../ui/Icono';
import { Insignia } from '../../ui/Insignia';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { Tabla } from '../../ui/Tabla';
import { Tarjeta } from '../../ui/Tarjeta';
import { useNegocio } from '../negocio/contexto';
import { ir, mensajeDe } from './comun';
import { Aviso } from './formularios';
import { Selector } from './Selector';

export const ACEPTA_TABLAS =
  '.xls,.xlsx,.csv,.txt,.html,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const CAMPOS: readonly { campo: CampoImportable; etiqueta: string; ayuda?: string }[] = [
  { campo: 'nombre', etiqueta: 'Nombre', ayuda: 'Obligatorio.' },
  { campo: 'cantidad', etiqueta: 'Cantidad (existencia final)', ayuda: 'Obligatoria. Puede ser negativa.' },
  { campo: 'precio', etiqueta: 'Precio de venta' },
  { campo: 'costo', etiqueta: 'Costo' },
  { campo: 'categoria', etiqueta: 'Categoría' },
  { campo: 'codigo', etiqueta: 'Código' },
  { campo: 'unidad', etiqueta: 'Unidad' },
];

const EJEMPLO_CONVENCION: Record<Convencion, string> = {
  'es-CO': '1.234,50 (coma decimal, punto de miles)',
  en: '1,234.50 (punto decimal, coma de miles)',
};

interface Archivo {
  /** Solo para mostrarlo en la vista previa; no se guarda en ninguna parte. */
  nombre: string;
  tabla: TablaDatos;
  filaEncabezado: number;
}

type FilaVista = { clave: string; nombre: string; accion: 'crear' | 'ajustar' | 'igual'; antes: string; despues: string };

function cambia(a: AccionImportacion): boolean {
  if (a.tipo === 'crear') return true;
  if (a.modo === 'sumar') return a.delta !== 0;
  return a.objetivo !== (a.antes ?? 0);
}

/**
 * Importar inventario (Excel o CSV): elegir archivo → revisar columnas, modo y vista previa →
 * confirmar → resumen. Nada se escribe antes de confirmar. El nombre del archivo solo se ve en la
 * vista previa; no se guarda ni se nombra el sistema de origen.
 */
export function ImportarInventario() {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [mapeo, setMapeo] = useState<MapeoColumnas>({});
  const [modo, setModo] = useState<ModoImportacion>('fijar');
  const [convencion, setConvencion] = useState<Convencion | null>(null);
  const [precios, setPrecios] = useState(false);
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ r: ResultadoImportacion; erroresArchivo: number } | null>(null);

  const puede = negocio.puede('inventario.importar');
  const puedeCrear = negocio.puede('producto.crear');
  const puedePrecios = negocio.puede('producto.editarPrecio');

  async function elegir(f: File | undefined) {
    if (!f) return;
    setError('');
    setResultado(null);
    if (f.size > LIMITES.bytes) {
      setError('El archivo pesa más de 10 MB; exporta solo el inventario.');
      return;
    }
    setLeyendo(true);
    try {
      // El nombre real no entra a los mensajes de error ni a ningún registro
      const tabla = leerTabla(await leerBytes(f), 'El archivo');
      const filaEncabezado = buscarFilaEncabezado(tabla);
      setArchivo({ nombre: f.name, tabla, filaEncabezado });
      setMapeo(detectarColumnas(tabla[filaEncabezado] ?? []));
      setConvencion(null);
      setPrecios(false);
    } catch (e) {
      setArchivo(null);
      setError(mensajeDe(e, 'No se pudo leer el archivo. Prueba guardarlo como .xlsx o .csv.'));
    } finally {
      setLeyendo(false);
    }
  }

  const columnas = useMemo(() => (archivo ? listarColumnas(archivo.tabla, archivo.filaEncabezado) : []), [archivo]);

  const vista = useMemo(() => {
    if (!archivo) return null;
    let filas: ResultadoFilas;
    try {
      filas = filasImportables(archivo.tabla, mapeo, {
        filaEncabezado: archivo.filaEncabezado,
        ...(convencion ? { convencion } : {}),
      });
    } catch (e) {
      return { error: mensajeDe(e) } as const;
    }
    const existentes = Object.values(estado.productos)
      .filter((p) => p.activo)
      .map((p) => ({ id: p.id, nombre: p.nombre, ...(p.codigo ? { codigo: p.codigo } : {}), cantidad: stockDe(estado, p.id) }));
    const acciones = planImportacion(existentes, filas.filas, modo);
    const crear = acciones.filter((a) => a.tipo === 'crear').length;
    const ajustar = acciones.filter((a) => a.tipo === 'ajustar' && cambia(a)).length;
    const filasVista: FilaVista[] = acciones.slice(0, 200).map((a) => {
      if (a.tipo === 'crear') {
        return { clave: `f${a.fila.filaOriginal}`, nombre: a.fila.nombre, accion: 'crear', antes: '—', despues: mostrarCantidad(a.fila.cantidad) };
      }
      const antes = a.antes ?? milesimas(0);
      const despues = a.modo === 'fijar' ? a.objetivo : milesimas(antes + a.delta);
      return {
        clave: `f${a.fila.filaOriginal}`,
        nombre: a.nombre,
        accion: cambia(a) ? 'ajustar' : 'igual',
        antes: mostrarCantidad(antes),
        despues: mostrarCantidad(despues),
      };
    });
    return { filas, acciones, crear, ajustar, igual: acciones.length - crear - ajustar, filasVista } as const;
  }, [archivo, mapeo, modo, convencion, estado]);

  async function confirmar() {
    if (!vista || 'error' in vista) return;
    setOcupado(true);
    setError('');
    try {
      const r = await negocio.importarInventario(vista.acciones, { actualizarPrecios: precios && puedePrecios });
      setResultado({ r, erroresArchivo: vista.filas.errores.length });
      // Se olvida el archivo (y su nombre) en cuanto termina
      setArchivo(null);
      setMapeo({});
      avisar(`Inventario importado: ${r.creados} nuevos, ${r.ajustados} ajustados.`);
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo importar. No se guardó nada.'));
    } finally {
      setOcupado(false);
    }
  }

  const volver = () => ir('#/inventario');

  if (!puede) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Importar inventario" accion={{ etiqueta: 'Volver', alTocar: volver }} />
        <EstadoVacio mensaje="Tu cargo no importa inventario." pista="Lo hacen el dueño o bodega." />
      </Pagina>
    );
  }

  // --- Resumen -----------------------------------------------------------------------
  if (resultado) {
    const { r } = resultado;
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Inventario importado" accion={{ etiqueta: 'Volver', alTocar: volver }} />
        <div class="inv-importar">
          <Rejilla tipo="cifra" etiqueta="Resultado">
            <Cifra etiqueta="Productos nuevos" icono="mas-signo" valor={String(r.creados)} color="esmeralda" />
            <Cifra etiqueta="Existencias ajustadas" icono="inventario" valor={String(r.ajustados)} color="indigo" />
            <Cifra etiqueta="Sin cambio" icono="check" valor={String(r.sinCambio)} color="cielo" />
            <Cifra etiqueta="Filas no importadas" icono="alerta" valor={String(r.errores.length + resultado.erroresArchivo)} color="coral" />
          </Rejilla>
          {r.errores.length > 0 && (
            <Tabla
              titulo="No se pudieron importar"
              verTitulo
              columnas={[
                { clave: 'fila', titulo: 'Fila', numerica: true, celda: (x: (typeof r.errores)[number]) => String(x.fila) },
                { clave: 'nombre', titulo: 'Producto', principal: true, celda: (x: (typeof r.errores)[number]) => x.nombre },
                { clave: 'motivo', titulo: 'Motivo', celda: (x: (typeof r.errores)[number]) => x.motivo },
              ]}
              filas={r.errores}
              claveFila={(x) => `${x.fila}-${x.nombre}`}
            />
          )}
          <p class="inv-suave">Ahora completa en cada producto el precio de venta, el costo, la categoría y el mínimo.</p>
          <div class="inv-pie">
            <Boton alTocar={() => setResultado(null)}>Importar otro archivo</Boton>
            <Boton variante="primario" alTocar={volver}>
              Ver inventario
            </Boton>
          </div>
        </div>
      </Pagina>
    );
  }

  const selectorArchivo = (
    <input
      ref={entrada}
      class="solo-lector"
      type="file"
      accept={ACEPTA_TABLAS}
      aria-label="Elegir archivo de inventario"
      tabIndex={-1}
      onChange={(e) => {
        const input = e.currentTarget;
        void elegir(input.files?.[0]).finally(() => (input.value = ''));
      }}
    />
  );

  // --- Elegir archivo ------------------------------------------------------------------
  if (!archivo) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Importar inventario" accion={{ etiqueta: 'Volver', alTocar: volver }} />
        <div class="inv-importar">
          <Tarjeta>
            <div class="inv-importar__intro">
              <Icono nombre="importar" tamano={32} />
              <p>
                Sirve el «.xls» que exporta tu sistema anterior (es una tabla), un .xlsx o un .csv. La app reconoce las columnas
                (Nombre, Final o Existencia, Precio, Costo, Categoría), te muestra una vista previa y solo guarda cuando confirmes.
              </p>
              {selectorArchivo}
              <Boton variante="primario" icono="importar" desactivado={leyendo} alTocar={() => entrada.current?.click()}>
                {leyendo ? 'Leyendo…' : 'Elegir archivo (Excel o CSV)'}
              </Boton>
            </div>
          </Tarjeta>
          <Aviso texto={error} />
        </div>
      </Pagina>
    );
  }

  // --- Revisar y confirmar ---------------------------------------------------------
  const opcionesColumna = [
    { valor: '', etiqueta: '— Ninguna —' },
    ...columnas.map((c) => ({
      valor: String(c.indice),
      etiqueta: `${letraColumna(c.indice)} · ${c.titulo}${c.ejemplos.length ? ` (ej.: ${c.ejemplos.join(', ')})` : ''}`,
    })),
  ];
  const ponerColumna = (campo: CampoImportable, v: string) =>
    setMapeo((m) => {
      const nuevo: MapeoColumnas = {};
      for (const [k, i] of Object.entries(m) as [CampoImportable, number][]) {
        // Una columna alimenta un solo campo: si se elige en otro, se quita de aquí
        if (k !== campo && String(i) !== v) nuevo[k] = i;
      }
      if (v !== '') nuevo[campo] = Number(v);
      return nuevo;
    });
  const hayPrecios = mapeo.precio !== undefined || mapeo.costo !== undefined;
  const conv = convencion ?? (vista && !('error' in vista) ? vista.filas.convencion : 'es-CO');

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Revisar importación" accion={{ etiqueta: 'Cancelar', alTocar: () => setArchivo(null) }} />
      <div class="inv-importar">
        <p class="inv-importar__archivo">
          <Icono nombre="factura" />
          <span>
            <span class="solo-lector">Archivo: </span>
            {archivo.nombre}
            <span class="inv-suave">
              {' '}
              · {archivo.tabla.length} filas · encabezados en la fila {archivo.filaEncabezado + 1}
            </span>
          </span>
        </p>

        <section class="inv-seccion" aria-labelledby="imp-columnas">
          <h2 class="inv-seccion__titulo" id="imp-columnas">
            Columnas
          </h2>
          <p class="inv-suave">Revisa qué columna alimenta cada dato. Las que no elijas se ignoran.</p>
          <div class="inv-importar__columnas">
            {CAMPOS.map((c) => (
              <Selector
                key={c.campo}
                etiqueta={c.etiqueta}
                ayuda={c.ayuda}
                valor={mapeo[c.campo] === undefined ? '' : String(mapeo[c.campo])}
                opciones={opcionesColumna}
                alCambiar={(v) => ponerColumna(c.campo, v)}
              />
            ))}
          </div>
        </section>

        <section class="inv-seccion" aria-labelledby="imp-modo">
          <h2 class="inv-seccion__titulo" id="imp-modo">
            Cómo importar
          </h2>
          <Segmentado
            etiqueta="Modo de importación"
            opciones={[
              { valor: 'fijar', etiqueta: 'Fijar existencias' },
              { valor: 'sumar', etiqueta: 'Sumar a lo que hay' },
            ]}
            valor={modo}
            alCambiar={setModo}
          />
          <p class="inv-suave">
            {modo === 'fijar'
              ? 'Cada producto queda con la cantidad del archivo (como un conteo).'
              : 'La cantidad del archivo se suma a la existencia actual.'}
          </p>
          <p class="inv-importar__convencion">
            Números leídos como <strong class="cifras">{EJEMPLO_CONVENCION[conv]}</strong>.
          </p>
          <Segmentado
            etiqueta="Formato de los números"
            opciones={[
              { valor: 'es-CO', etiqueta: '1.234,50' },
              { valor: 'en', etiqueta: '1,234.50' },
            ]}
            valor={conv}
            alCambiar={setConvencion}
          />
          {hayPrecios && puedePrecios && (
            <Interruptor
              etiqueta="Actualizar precio y costo de los que ya existen"
              descripcion="Los productos nuevos siempre toman el precio y el costo del archivo."
              activo={precios}
              alCambiar={setPrecios}
            />
          )}
        </section>

        <section class="inv-seccion" aria-labelledby="imp-previa">
          <h2 class="inv-seccion__titulo" id="imp-previa">
            Vista previa
          </h2>
          {!vista || 'error' in vista ? (
            <Aviso texto={vista?.error ?? ''} />
          ) : (
            <>
              <Rejilla tipo="cifra" etiqueta="Resumen de la vista previa">
                <Cifra etiqueta="Crear" icono="mas-signo" valor={String(vista.crear)} color="esmeralda" />
                <Cifra etiqueta="Ajustar" icono="inventario" valor={String(vista.ajustar)} color="indigo" />
                <Cifra etiqueta="Sin cambio" icono="check" valor={String(vista.igual)} color="cielo" />
                <Cifra etiqueta="Filas con error" icono="alerta" valor={String(vista.filas.errores.length)} color="coral" />
              </Rejilla>
              {!puedeCrear && vista.crear > 0 && (
                <p class="inv-error" role="alert">
                  Tu cargo no crea productos: las {vista.crear} filas nuevas no se importarán. Pídeselo al dueño.
                </p>
              )}
              {vista.filas.errores.length > 0 && (
                <details class="inv-importar__errores">
                  <summary>Ver filas con error ({vista.filas.errores.length})</summary>
                  <ul>
                    {vista.filas.errores.map((e) => (
                      <li key={`${e.fila}-${e.motivo}`}>
                        <span class="cifras">Fila {e.fila}:</span> {e.motivo}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Tabla
                titulo="Productos a importar"
                verTitulo
                columnas={[
                  { clave: 'nombre', titulo: 'Producto', principal: true, celda: (x: FilaVista) => x.nombre },
                  {
                    clave: 'accion',
                    titulo: 'Acción',
                    celda: (x: FilaVista) =>
                      x.accion === 'crear' ? (
                        <Insignia tono="exito">Nuevo</Insignia>
                      ) : x.accion === 'ajustar' ? (
                        <Insignia tono="primario">Ajuste</Insignia>
                      ) : (
                        <Insignia>Sin cambio</Insignia>
                      ),
                  },
                  { clave: 'antes', titulo: 'Antes', numerica: true, celda: (x: FilaVista) => x.antes },
                  { clave: 'despues', titulo: 'Después', numerica: true, celda: (x: FilaVista) => x.despues },
                ]}
                filas={vista.filasVista}
                claveFila={(x) => x.clave}
                vacia="No hay filas para importar."
              />
              {vista.acciones.length > vista.filasVista.length && (
                <p class="inv-suave">Se muestran las primeras {vista.filasVista.length} de {vista.acciones.length}.</p>
              )}
            </>
          )}
        </section>

        <Aviso texto={error} />
        <div class="inv-pie">
          <Boton variante="texto" alTocar={() => setArchivo(null)}>
            Elegir otro archivo
          </Boton>
          <Boton
            variante="primario"
            icono="check"
            desactivado={ocupado || !vista || 'error' in vista || vista.acciones.length === 0}
            alTocar={() => void confirmar()}
          >
            {ocupado ? 'Importando…' : 'Confirmar importación'}
          </Boton>
        </div>
      </div>
    </Pagina>
  );
}
