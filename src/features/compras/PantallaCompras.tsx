import { useMemo, useState } from 'preact/hooks';
import { pesos, sumar, type Compra } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { BotonFlotante } from '../../ui/BotonFlotante';
import { Buscador } from '../../ui/Buscador';
import { Casilla } from '../../ui/Casilla';
import { Chip, ChipFiltro, GrupoChips } from '../../ui/Chip';
import { Cifra } from '../../ui/Cifra';
import { Disposicion, Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Tabla } from '../../ui/Tabla';
import { useNegocio } from '../negocio/contexto';
import { consultaDe, fechaCorta, hoy, ir, normal, useHash } from '../inventario/comun';
import { FichaFactura } from './FichaFactura';
import { MARCAS, marcasDe, NOMBRE_MARCA, TONO_MARCA, type Marca } from './marcas';
import { NuevaFactura } from './NuevaFactura';
import '../inventario/inventario.css';

/** Compras y facturas (`#/compras`). `?nueva` abre el formulario; `?factura=<id>`, la ficha. */
export function PantallaCompras() {
  const q = consultaDe(useHash());
  const id = q.get('factura');
  if (q.has('nueva')) return <NuevaFactura />;
  if (id) return <FichaFactura key={id} id={id} />;
  return <ListaCompras />;
}

interface Fila {
  compra: Compra;
  marcas: Marca[];
}

function ListaCompras() {
  const { negocio, estado } = useNegocio();
  const [busqueda, setBusqueda] = useState('');
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const dia = hoy();

  const filas: Fila[] = useMemo(
    () =>
      Object.values(estado.compras)
        .map((compra) => ({ compra, marcas: marcasDe(compra, dia) }))
        .sort((a, b) => (b.compra.fecha + b.compra.registradaEn).localeCompare(a.compra.fecha + a.compra.registradaEn)),
    [estado.compras, dia],
  );

  if (!negocio.puede('compra.ver')) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Compras y facturas" />
        <EstadoVacio mensaje="Tu cargo no ve las facturas de compra." pista="Las manejan el dueño y bodega." />
      </Pagina>
    );
  }

  const qn = normal(busqueda);
  const visibles = filas.filter(
    (f) =>
      (!qn || normal(`${f.compra.proveedor} ${f.compra.numero}`).includes(qn)) &&
      (marcas.length === 0 || f.marcas.some((m) => marcas.includes(m))) &&
      (proveedores.length === 0 || proveedores.includes(f.compra.proveedor)),
  );
  const conteoProveedor = new Map<string, number>();
  for (const f of filas) conteoProveedor.set(f.compra.proveedor, (conteoProveedor.get(f.compra.proveedor) ?? 0) + 1);
  const vigentes = filas.filter((f) => f.compra.estado !== 'anulada');
  const porPagar = sumar(vigentes.map((f) => f.compra.saldo));
  const vencidas = vigentes.filter((f) => f.marcas.includes('vencida'));
  const porAplicar = vigentes.filter((f) => f.compra.estado === 'registrada').length;
  const activos = marcas.length + proveedores.length;
  const alternar = <T,>(lista: T[], x: T, si: boolean) => (si ? [...lista, x] : lista.filter((y) => y !== x));

  const panel = (
    <>
      <fieldset class="inv-filtro">
        <legend class="inv-filtro__titulo">Estado</legend>
        <GrupoChips etiqueta="Estado de la factura">
          {MARCAS.map((m) => (
            <Chip
              key={m}
              seleccionado={marcas.includes(m)}
              contador={filas.filter((f) => f.marcas.includes(m)).length}
              alCambiar={(si) => setMarcas((l) => alternar(l, m, si))}
            >
              {NOMBRE_MARCA[m]}
            </Chip>
          ))}
        </GrupoChips>
      </fieldset>
      <fieldset class="inv-filtro">
        <legend class="inv-filtro__titulo">Proveedor</legend>
        <div class="inv-filtro__lista">
          {[...conteoProveedor]
            .sort((a, b) => a[0].localeCompare(b[0], 'es'))
            .map(([p, n]) => (
              <Casilla key={p} etiqueta={p} contador={n} marcada={proveedores.includes(p)} alCambiar={(si) => setProveedores((l) => alternar(l, p, si))} />
            ))}
          {conteoProveedor.size === 0 && <p class="inv-suave">Sin proveedores todavía.</p>}
        </div>
      </fieldset>
    </>
  );

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Compras y facturas" />
      {filas.length > 0 && (
        <div class="inv-resumen">
          <Rejilla tipo="cifra" etiqueta="Resumen de compras">
            <Cifra etiqueta="Por pagar" icono="gasto" valor={pesos(porPagar)} color="coral" />
            <Cifra etiqueta="Vencidas" icono="alerta" valor={String(vencidas.length)} color="ambar" />
            <Cifra etiqueta="Por aplicar" icono="inventario" valor={String(porAplicar)} color="indigo" />
          </Rejilla>
        </div>
      )}
      <Disposicion
        activos={activos}
        panel={panel}
        barra={
          <span class="inv-buscador">
            <Buscador etiqueta="Buscar facturas" marcador="Buscar por proveedor o número" valor={busqueda} alCambiar={setBusqueda} />
          </span>
        }
      >
        {activos > 0 && (
          <div class="inv-activos">
            <p class="inv-activos__titulo">Filtros activos</p>
            <GrupoChips etiqueta="Filtros activos">
              {marcas.map((m) => (
                <ChipFiltro key={m} alQuitar={() => setMarcas((l) => l.filter((x) => x !== m))}>
                  {NOMBRE_MARCA[m]}
                </ChipFiltro>
              ))}
              {proveedores.map((p) => (
                <ChipFiltro key={p} alQuitar={() => setProveedores((l) => l.filter((x) => x !== p))}>
                  {p}
                </ChipFiltro>
              ))}
              <Boton
                variante="texto"
                alTocar={() => {
                  setMarcas([]);
                  setProveedores([]);
                }}
              >
                Limpiar todo
              </Boton>
            </GrupoChips>
          </div>
        )}
        {filas.length === 0 ? (
          <EstadoVacio mensaje="Aún no hay facturas." pista="Cuando llegue el proveedor, registra su factura con «Nueva factura»." />
        ) : (
          <Tabla
            titulo="Facturas"
            columnas={[
              {
                clave: 'f',
                titulo: 'Factura',
                principal: true,
                celda: (f: Fila) => `${f.compra.proveedor} · ${f.compra.numero}`,
              },
              { clave: 'fecha', titulo: 'Fecha', celda: (f: Fila) => fechaCorta(f.compra.fecha) },
              { clave: 'vence', titulo: 'Vence', celda: (f: Fila) => (f.compra.vence ? fechaCorta(f.compra.vence) : '—') },
              { clave: 'total', titulo: 'Total', numerica: true, celda: (f: Fila) => pesos(f.compra.total) },
              { clave: 'saldo', titulo: 'Saldo', numerica: true, celda: (f: Fila) => pesos(f.compra.saldo) },
              {
                clave: 'estado',
                titulo: 'Estado',
                celda: (f: Fila) => (
                  <span class="inv-insignias">
                    {f.marcas.map((m) => (
                      <Insignia key={m} tono={TONO_MARCA[m]}>
                        {NOMBRE_MARCA[m]}
                      </Insignia>
                    ))}
                  </span>
                ),
              },
            ]}
            filas={visibles}
            claveFila={(f) => f.compra.id}
            alTocarFila={(f) => ir(`#/compras?factura=${f.compra.id}`)}
            vacia="Ninguna factura con esos filtros."
          />
        )}
      </Disposicion>
      <div class="inv-espacio-flotante" aria-hidden="true" />
      {negocio.puede('compra.registrar') && <BotonFlotante etiqueta="Nueva factura" extendido alTocar={() => ir('#/compras?nueva')} />}
    </Pagina>
  );
}
