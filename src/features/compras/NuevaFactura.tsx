import { useState } from 'preact/hooks';
import {
  importe,
  leerCantidad,
  leerDinero,
  pesos,
  pesosPlano,
  sumar,
  type Centavos,
  type LineaCompra,
  type Producto,
} from '../../core/negocio';
import { useEstado } from '../../app/estado';
import { Boton } from '../../ui/Boton';
import { Buscador } from '../../ui/Buscador';
import { CampoNumero } from '../../ui/CampoNumero';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Icono } from '../../ui/Icono';
import { Pagina } from '../../ui/Pagina';
import { SelectorFecha } from '../../ui/SelectorFecha';
import { useNegocio } from '../negocio/contexto';
import { SelectorAdjunto, useGuardarAdjuntos, type ArchivoPendiente } from '../adjuntos/componentes';
import { ABREV_UNIDAD, fechaCorta, hoy, ir, mensajeDe, normal } from '../inventario/comun';
import { Aviso } from '../inventario/formularios';
import { CampoNota } from '../inventario/Selector';
import '../inventario/inventario.css';

interface Renglon {
  clave: number;
  productoId: string;
  cantidad: string;
  costo: string;
}

let siguiente = 0;

/** Importe de un renglón si sus números son válidos; null si no. */
function importeDe(r: Renglon): Centavos | null {
  try {
    return importe(leerCantidad(r.cantidad), leerDinero(r.costo));
  } catch {
    return null;
  }
}

/** Campo de fecha que abre el calendario propio (SelectorFecha). */
function CampoFecha({ etiqueta, valor, alCambiar, opcional }: { etiqueta: string; valor: string | null; alCambiar: (d: string | null) => void; opcional?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div class="inv-fecha">
      <span class="campo__etiqueta">{etiqueta}</span>
      <span class="inv-acciones">
        <Boton icono="calendario" etiqueta={`${etiqueta}: ${valor ? fechaCorta(valor) : 'sin fecha'}. Cambiar`} alTocar={() => setAbierto(true)}>
          {valor ? fechaCorta(valor) : 'Sin fecha'}
        </Boton>
        {opcional && valor && (
          <Boton variante="texto" alTocar={() => alCambiar(null)}>
            Quitar
          </Boton>
        )}
      </span>
      {abierto && (
        <SelectorFecha
          alCerrar={() => setAbierto(false)}
          alElegir={(d) => {
            alCambiar(d);
            setAbierto(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Nueva factura de proveedor (`#/compras?nueva`). Registrar NO toca el inventario: eso es
 * «Aplicar», en la ficha. El total lo calcula el núcleo; aquí solo se muestra la vista previa.
 */
export function NuevaFactura() {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const guardarAdjuntos = useGuardarAdjuntos();
  const [proveedor, setProveedor] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState<string | null>(hoy());
  const [vence, setVence] = useState<string | null>(null);
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [adjuntos, setAdjuntos] = useState<ArchivoPendiente[]>([]);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!negocio.puede('compra.registrar')) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Nueva factura" accion={{ etiqueta: 'Volver', alTocar: () => ir('#/compras') }} />
        <EstadoVacio mensaje="Tu cargo no registra facturas." pista="Lo hacen el dueño o bodega." />
      </Pagina>
    );
  }

  const proveedores = [...new Set(Object.values(estado.compras).map((c) => c.proveedor))].sort((a, b) => a.localeCompare(b, 'es'));
  const qp = normal(proveedor);
  const sugeridos = proveedores.filter((p) => normal(p) !== qp && (!qp || normal(p).includes(qp))).slice(0, 6);

  const usados = new Set(renglones.map((r) => r.productoId));
  const q = normal(busqueda);
  const encontrados: Producto[] = q
    ? Object.values(estado.productos)
        .filter((p) => p.activo && !usados.has(p.id) && normal(`${p.nombre} ${p.codigo ?? ''}`).includes(q))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 8)
    : [];

  const agregar = (p: Producto) => {
    setRenglones((l) => [...l, { clave: ++siguiente, productoId: p.id, cantidad: '', costo: p.costo === null ? '' : pesosPlano(p.costo) }]);
    setBusqueda('');
  };
  const cambiar = (clave: number, parcial: Partial<Renglon>) =>
    setRenglones((l) => l.map((r) => (r.clave === clave ? { ...r, ...parcial } : r)));
  const importes = renglones.map(importeDe);
  const total = sumar(importes.filter((x): x is Centavos => x !== null));

  async function registrar() {
    setError('');
    if (!proveedor.trim()) return setError('Escribe el proveedor.');
    if (!numero.trim()) return setError('Escribe el número de la factura.');
    if (!fecha) return setError('Elige la fecha de la factura.');
    if (renglones.length === 0) return setError('Agrega al menos un producto.');
    let lineas: LineaCompra[];
    try {
      lineas = renglones.map((r) => {
        const nombre = estado.productos[r.productoId]?.nombre ?? 'un producto';
        let cantidad;
        try {
          cantidad = leerCantidad(r.cantidad);
        } catch (e) {
          throw new Error(`«${nombre}»: ${mensajeDe(e)}`);
        }
        if (cantidad === 0) throw new Error(`«${nombre}»: la cantidad debe ser mayor que cero.`);
        let costoUnit;
        try {
          costoUnit = leerDinero(r.costo);
        } catch (e) {
          throw new Error(`«${nombre}»: costo — ${mensajeDe(e)}`);
        }
        return { productoId: r.productoId, cantidad, costoUnit };
      });
    } catch (e) {
      return setError(e instanceof Error ? e.message : String(e));
    }
    setOcupado(true);
    let deshacer = async () => undefined as void;
    try {
      const guardados = await guardarAdjuntos(adjuntos);
      deshacer = guardados.deshacer;
      const ev = await negocio.registrarCompra({ proveedor, numero, fecha, vence, lineas, adjuntos: guardados.ids, nota });
      avisar(`Factura ${numero.trim()} registrada. Revísala y aplícala al inventario.`);
      ir(`#/compras?factura=${ev.id}`);
    } catch (e) {
      await deshacer();
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Nueva factura" accion={{ etiqueta: 'Cancelar', alTocar: () => ir('#/compras') }} />
      <div class="inv-ficha">
        <section class="inv-seccion" aria-labelledby="nf-datos">
          <h2 class="inv-seccion__titulo" id="nf-datos">
            Datos
          </h2>
          <div class="inv-form">
            <div class="inv-form__grupo">
              <CampoTexto etiqueta="Proveedor" valor={proveedor} alCambiar={setProveedor} marcador="Ej.: Distribuidora del Valle" />
              {sugeridos.length > 0 && (
                <GrupoChips etiqueta="Proveedores anteriores">
                  {sugeridos.map((p) => (
                    <Chip key={p} seleccionado={false} alCambiar={() => setProveedor(p)}>
                      {p}
                    </Chip>
                  ))}
                </GrupoChips>
              )}
            </div>
            <div class="inv-form__par">
              <CampoTexto etiqueta="Número de factura" valor={numero} alCambiar={setNumero} marcador="Ej.: FV-1234" />
              <CampoFecha etiqueta="Fecha" valor={fecha} alCambiar={setFecha} />
              <CampoFecha etiqueta="Vence" valor={vence} alCambiar={setVence} opcional />
            </div>
          </div>
        </section>

        <section class="inv-seccion" aria-labelledby="nf-renglones">
          <h2 class="inv-seccion__titulo" id="nf-renglones">
            Productos
          </h2>
          {renglones.length > 0 && (
            <ul class="inv-renglones">
              {renglones.map((r, i) => {
                const p = estado.productos[r.productoId];
                const u = p ? ABREV_UNIDAD[p.unidad] : '';
                const imp = importes[i];
                return (
                  <li key={r.clave} class="inv-renglon">
                    <div class="inv-renglon__cabeza">
                      <p class="inv-renglon__producto">{p?.nombre ?? '—'}</p>
                      <button
                        type="button"
                        class="adjuntos__quitar"
                        aria-label={`Quitar ${p?.nombre ?? 'renglón'}`}
                        onClick={() => setRenglones((l) => l.filter((x) => x.clave !== r.clave))}
                      >
                        <Icono nombre="cerrar" tamano={20} />
                      </button>
                    </div>
                    <div class="inv-form__par">
                      <CampoNumero etiqueta={`Cantidad de ${p?.nombre ?? ''}`} sufijo={u} valor={r.cantidad} alCambiar={(v) => cambiar(r.clave, { cantidad: v })} />
                      <CampoNumero etiqueta="Costo unitario" prefijo="$" valor={r.costo} alCambiar={(v) => cambiar(r.clave, { costo: v })} />
                    </div>
                    <p class="inv-renglon__importe cifras">{imp === null || imp === undefined ? '—' : pesos(imp)}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <Buscador etiqueta="Agregar producto a la factura" marcador="Agregar producto: escribe el nombre" valor={busqueda} alCambiar={setBusqueda} />
          {q && (
            <ul class="inv-buscados" aria-label="Productos encontrados">
              {encontrados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => agregar(p)}>
                    <span>{p.nombre}</span>
                    <span class="inv-suave">{p.categoria}</span>
                  </button>
                </li>
              ))}
              {encontrados.length === 0 && <li class="inv-suave">Ningún producto activo con ese nombre. Créalo en Inventario.</li>}
            </ul>
          )}
          <p class="inv-total">
            <span>Total</span>
            <span class="cifras">{pesos(total)}</span>
          </p>
        </section>

        <section class="inv-seccion" aria-labelledby="nf-soporte">
          <h2 class="inv-seccion__titulo" id="nf-soporte">
            Soporte
          </h2>
          <SelectorAdjunto archivos={adjuntos} alCambiar={setAdjuntos} />
          <CampoNota etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} />
        </section>

        <Aviso texto={error} />
        <div class="inv-pie">
          <Boton variante="texto" alTocar={() => ir('#/compras')}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono="check" desactivado={ocupado} alTocar={() => void registrar()}>
            {ocupado ? 'Guardando…' : 'Registrar factura'}
          </Boton>
        </div>
      </div>
    </Pagina>
  );
}
