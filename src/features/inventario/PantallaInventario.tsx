import { useMemo, useState } from 'preact/hooks';
import { alertas, mostrarCantidad, pesos } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { BotonFlotante } from '../../ui/BotonFlotante';
import { Buscador } from '../../ui/Buscador';
import { Casilla } from '../../ui/Casilla';
import { Chip, ChipFiltro, GrupoChips } from '../../ui/Chip';
import { Conmutador } from '../../ui/Conmutador';
import { Disposicion, Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Icono } from '../../ui/Icono';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Rango } from '../../ui/Rango';
import { Tabla } from '../../ui/Tabla';
import { TarjetaProducto } from '../../ui/TarjetaProducto';
import { useNegocio } from '../negocio/contexto';
import { ABREV_UNIDAD, consultaDe, ir, NOMBRE_ESTADO_STOCK, useHash } from './comun';
import { FichaProducto } from './FichaProducto';
import {
  contarCategorias,
  cuantosActivos,
  ESTADOS_FILTRO,
  FILTROS_INICIALES,
  filasInventario,
  filtrar,
  limitesExistencias,
  type EstadoFiltro,
  type FilaInventario,
  type Filtros,
} from './filtros';
import { FormularioProducto } from './formularios';
import { ImportarInventario } from './ImportarInventario';
import './inventario.css';

const VISTA_GUARDADA = 'stark.inventario.vista';

function leerVista(): 'rejilla' | 'lista' {
  try {
    return localStorage.getItem(VISTA_GUARDADA) === 'lista' ? 'lista' : 'rejilla';
  } catch {
    return 'rejilla';
  }
}

/**
 * Inventario (`#/inventario`). Con `?producto=<id>` abre la ficha; con `?importar` el importador.
 */
export function PantallaInventario() {
  const q = consultaDe(useHash());
  const id = q.get('producto');
  if (q.has('importar')) return <ImportarInventario />;
  if (id) return <FichaProducto key={id} id={id} />;
  return <ListaInventario />;
}

const abrirProducto = (id: string) => ir(`#/inventario?producto=${encodeURIComponent(id)}`);

function ListaInventario() {
  const { negocio, estado } = useNegocio();
  const [f, setF] = useState<Filtros>(FILTROS_INICIALES);
  const [vista, setVistaEstado] = useState(leerVista);
  const [nuevo, setNuevo] = useState(false);
  const [buscarCat, setBuscarCat] = useState('');
  const verCostos = negocio.puede('inventario.verCostos');

  const todas = useMemo(() => filasInventario(estado), [estado]);
  const visibles = useMemo(() => filtrar(todas, f), [todas, f]);
  const base = useMemo(() => (f.soloActivos ? todas.filter((x) => x.producto.activo) : todas), [todas, f.soloActivos]);
  const categorias = contarCategorias(base);
  const [minE, maxE] = limitesExistencias(base);
  const avisos = alertas(estado);
  const negativos = avisos.filter((a) => a.tipo === 'negativo').length;
  const bajos = avisos.length - negativos;
  const porEstado = (e: EstadoFiltro) => base.filter((x) => x.estado === e).length;
  const activos = cuantosActivos(f);

  const cambiar = (parcial: Partial<Filtros>) => setF((x) => ({ ...x, ...parcial }));
  const alternarCategoria = (c: string, si: boolean) =>
    cambiar({ categorias: si ? [...f.categorias, c] : f.categorias.filter((x) => x !== c) });
  const alternarEstado = (e: EstadoFiltro, si: boolean) => cambiar({ estados: si ? [...f.estados, e] : f.estados.filter((x) => x !== e) });
  const setVista = (v: 'rejilla' | 'lista') => {
    setVistaEstado(v);
    try {
      localStorage.setItem(VISTA_GUARDADA, v);
    } catch {
      // Sin almacenamiento local: la vista se recuerda solo mientras la pantalla esté abierta
    }
  };
  const textoExistencias = (x: FilaInventario) =>
    `${mostrarCantidad(x.stock)} ${ABREV_UNIDAD[x.producto.unidad]}${x.estado === 'negativo' ? ' (negativo)' : ''}`;

  const qCat = buscarCat.trim().toLocaleLowerCase('es');
  const panel = (
    <>
      <fieldset class="inv-filtro">
        <legend class="inv-filtro__titulo">Categorías</legend>
        {categorias.length > 8 && <Buscador etiqueta="Buscar categoría" valor={buscarCat} alCambiar={setBuscarCat} />}
        <div class="inv-filtro__lista">
          {categorias
            .filter(([c]) => !qCat || c.toLocaleLowerCase('es').includes(qCat))
            .map(([c, n]) => (
              <Casilla key={c} etiqueta={c} contador={n} marcada={f.categorias.includes(c)} alCambiar={(si) => alternarCategoria(c, si)} />
            ))}
          {categorias.length === 0 && <p class="inv-suave">Sin categorías todavía.</p>}
        </div>
      </fieldset>
      <Rango
        etiqueta="Existencias"
        min={minE}
        max={maxE}
        valorMin={f.existencias?.[0] ?? minE}
        valorMax={f.existencias?.[1] ?? maxE}
        alCambiar={(a, b) => cambiar({ existencias: a <= minE && b >= maxE ? null : [a, b] })}
      />
      <fieldset class="inv-filtro">
        <legend class="inv-filtro__titulo">Estado</legend>
        <GrupoChips etiqueta="Estado de existencias">
          {ESTADOS_FILTRO.map((e) => (
            <Chip key={e} seleccionado={f.estados.includes(e)} contador={porEstado(e)} alCambiar={(si) => alternarEstado(e, si)}>
              {NOMBRE_ESTADO_STOCK[e]}
            </Chip>
          ))}
        </GrupoChips>
      </fieldset>
      <Conmutador
        etiqueta="Solo activos"
        descripcion="Apágalo para ver también los archivados."
        activo={f.soloActivos}
        alCambiar={(si) => cambiar({ soloActivos: si })}
      />
    </>
  );

  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Inventario"
        iconos={[
          { icono: 'tarjetas', etiqueta: 'Ver en tarjetas', activo: vista === 'rejilla', alTocar: () => setVista('rejilla') },
          { icono: 'lista', etiqueta: 'Ver en lista', activo: vista === 'lista', alTocar: () => setVista('lista') },
        ]}
      />

      {avisos.length > 0 && (
        <div class="inv-alertas" role="status">
          <Icono nombre="alerta" />
          <p class="inv-alertas__texto">
            {negativos > 0 && (
              <span>
                <strong class="cifras">{negativos}</strong> con existencias negativas: cuéntalos o registra la factura.
              </span>
            )}
            {bajos > 0 && (
              <span>
                <strong class="cifras">{bajos}</strong> en el mínimo o por debajo: hay que pedir.
              </span>
            )}
          </p>
          <Boton variante="tonal" alTocar={() => cambiar({ estados: negativos > 0 && bajos > 0 ? ['negativo', 'bajo'] : negativos > 0 ? ['negativo'] : ['bajo'] })}>
            Ver
          </Boton>
        </div>
      )}

      <Disposicion
        activos={activos}
        panel={panel}
        barra={
          <>
            <span class="inv-buscador">
              <Buscador etiqueta="Buscar productos" marcador="Buscar por nombre, categoría o código" valor={f.busqueda} alCambiar={(v) => cambiar({ busqueda: v })} />
            </span>
            {negocio.puede('inventario.importar') && (
              <Boton icono="importar" alTocar={() => ir('#/inventario?importar')}>
                Importar (Excel o CSV)
              </Boton>
            )}
          </>
        }
      >
        {activos > 0 && (
          <div class="inv-activos">
            <p class="inv-activos__titulo">Filtros activos</p>
            <GrupoChips etiqueta="Filtros activos">
              {f.categorias.map((c) => (
                <ChipFiltro key={`c-${c}`} alQuitar={() => alternarCategoria(c, false)}>
                  {c}
                </ChipFiltro>
              ))}
              {f.existencias && (
                <ChipFiltro alQuitar={() => cambiar({ existencias: null })}>{`Existencias ${f.existencias[0]} – ${f.existencias[1]}`}</ChipFiltro>
              )}
              {f.estados.map((e) => (
                <ChipFiltro key={`e-${e}`} alQuitar={() => alternarEstado(e, false)}>
                  {NOMBRE_ESTADO_STOCK[e]}
                </ChipFiltro>
              ))}
              {!f.soloActivos && <ChipFiltro alQuitar={() => cambiar({ soloActivos: true })}>Con archivados</ChipFiltro>}
              <Boton variante="texto" alTocar={() => setF({ ...FILTROS_INICIALES, busqueda: f.busqueda })}>
                Limpiar todo
              </Boton>
            </GrupoChips>
          </div>
        )}

        <p class="inv-suave" aria-live="polite">
          {visibles.length === 1 ? '1 producto' : `${visibles.length} productos`}
        </p>

        {todas.length === 0 ? (
          <EstadoVacio
            mensaje="Aún no hay productos."
            pista={
              negocio.puede('inventario.importar')
                ? 'Importa el inventario de tu sistema anterior (Excel o CSV) o crea el primero con «Nuevo producto».'
                : 'Pídele al dueño que importe el inventario.'
            }
          />
        ) : visibles.length === 0 ? (
          <EstadoVacio mensaje="Ningún producto con esos filtros." pista="Quita alguno para ver más." />
        ) : vista === 'rejilla' ? (
          <Rejilla etiqueta="Productos">
            {visibles.map((x) => (
              <TarjetaProducto
                key={x.producto.id}
                nombre={x.producto.nombre}
                nombreCategoria={x.producto.activo ? x.producto.categoria : `${x.producto.categoria} · archivado`}
                precio={pesos(x.producto.precio)}
                existencias={textoExistencias(x)}
                estado={x.estado === 'ok' ? 'ok' : x.estado === 'bajo' ? 'bajo' : 'agotado'}
                alTocar={() => abrirProducto(x.producto.id)}
              />
            ))}
          </Rejilla>
        ) : (
          <Tabla
            titulo="Productos"
            columnas={[
              { clave: 'nombre', titulo: 'Producto', principal: true, celda: (x: FilaInventario) => x.producto.nombre },
              { clave: 'cat', titulo: 'Categoría', celda: (x: FilaInventario) => x.producto.categoria },
              { clave: 'stock', titulo: 'Existencias', numerica: true, celda: textoExistencias },
              {
                clave: 'min',
                titulo: 'Mínimo',
                numerica: true,
                celda: (x: FilaInventario) => (x.producto.stockMinimo === null ? '—' : mostrarCantidad(x.producto.stockMinimo)),
              },
              { clave: 'precio', titulo: 'Precio', numerica: true, celda: (x: FilaInventario) => pesos(x.producto.precio) },
              ...(verCostos
                ? [{ clave: 'costo', titulo: 'Costo', numerica: true, celda: (x: FilaInventario) => (x.producto.costo === null ? '—' : pesos(x.producto.costo)) }]
                : []),
              {
                clave: 'estado',
                titulo: 'Estado',
                celda: (x: FilaInventario) =>
                  !x.producto.activo ? (
                    <Insignia>Archivado</Insignia>
                  ) : x.estado === 'ok' ? (
                    <Insignia tono="exito">Disponible</Insignia>
                  ) : (
                    <Insignia tono={x.estado === 'bajo' ? 'aviso' : 'peligro'}>{NOMBRE_ESTADO_STOCK[x.estado]}</Insignia>
                  ),
              },
            ]}
            filas={visibles}
            claveFila={(x) => x.producto.id}
            alTocarFila={(x) => abrirProducto(x.producto.id)}
          />
        )}
      </Disposicion>

      <div class="inv-espacio-flotante" aria-hidden="true" />
      {negocio.puede('producto.crear') && <BotonFlotante etiqueta="Nuevo producto" extendido alTocar={() => setNuevo(true)} />}
      {nuevo && (
        <FormularioProducto
          alCerrar={(id) => {
            setNuevo(false);
            if (id) abrirProducto(id);
          }}
        />
      )}
    </Pagina>
  );
}
