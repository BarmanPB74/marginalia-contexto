import { useState } from 'preact/hooks';
import {
  centavos,
  leerCantidad,
  leerDinero,
  milesimas,
  mostrarCantidad,
  pesosPlano,
  stockDe,
  UNIDADES,
  type Centavos,
  type Milesimas,
  type NuevoProducto,
  type Producto,
  type Unidad,
} from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { CampoNumero } from '../../ui/CampoNumero';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Hoja } from '../../ui/Hoja';
import { Segmentado } from '../../ui/Segmentado';
import { useEstado } from '../../app/estado';
import { useNegocio } from '../negocio/contexto';
import { ABREV_UNIDAD, mensajeDe, normal } from './comun';
import { CampoNota } from './Selector';

/** Pie de las hojas: Cancelar + acción principal. */
function Pie({ etiqueta, alCerrar, alConfirmar, ocupado }: { etiqueta: string; alCerrar: () => void; alConfirmar: () => void; ocupado: boolean }) {
  return (
    <div class="inv-pie">
      <Boton variante="texto" alTocar={alCerrar}>
        Cancelar
      </Boton>
      <Boton variante="primario" desactivado={ocupado} alTocar={alConfirmar}>
        {etiqueta}
      </Boton>
    </div>
  );
}

export function Aviso({ texto }: { texto: string }) {
  return texto ? (
    <p class="inv-error" role="alert">
      {texto}
    </p>
  ) : null;
}

/** Ejecuta una operación del núcleo mostrando su error (si lo hay) y avisando al terminar. */
function useOperacion(alTerminar: () => void) {
  const { avisar } = useEstado();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function correr(fn: () => Promise<unknown>, aviso: string) {
    setError('');
    setOcupado(true);
    try {
      await fn();
      avisar(aviso);
      alTerminar();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }
  return { error, setError, ocupado, correr };
}

// --- Producto nuevo / editar -------------------------------------------------------

const dineroTexto = (c: Centavos | null) => (c === null ? '' : pesosPlano(c));

/**
 * Formulario de producto. Nuevo: nombre, categoría (con las existentes como sugerencia), unidad,
 * precio, costo, mínimo y código. Editar: solo manda lo que cambió; precio y costo solo aparecen
 * a quien puede cambiarlos (el núcleo lo vuelve a comprobar).
 */
export function FormularioProducto({ producto, alCerrar }: { producto?: Producto; alCerrar: (id?: string) => void }) {
  const { negocio, estado } = useNegocio();
  const puedePrecio = producto ? negocio.puede('producto.editarPrecio') : negocio.puede('producto.crear');
  const verCostos = negocio.puede('inventario.verCostos');
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [categoria, setCategoria] = useState(producto?.categoria ?? '');
  const [unidad, setUnidad] = useState<Unidad>(producto?.unidad ?? 'unidad');
  const [precio, setPrecio] = useState(producto ? dineroTexto(producto.precio) : '');
  const [costo, setCosto] = useState(dineroTexto(producto?.costo ?? null));
  const [minimo, setMinimo] = useState(producto?.stockMinimo != null ? mostrarCantidad(producto.stockMinimo) : '');
  const [codigo, setCodigo] = useState(producto?.codigo ?? '');
  const [errores, setErrores] = useState<Partial<Record<'nombre' | 'precio' | 'costo' | 'minimo', string>>>({});
  const op = useOperacion(() => undefined);

  const categorias = [...new Set(Object.values(estado.productos).filter((p) => p.activo).map((p) => p.categoria))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  const q = normal(categoria);
  const sugeridas = categorias.filter((c) => normal(c) !== q && (!q || normal(c).includes(q))).slice(0, 8);

  async function guardar() {
    const e: typeof errores = {};
    if (!nombre.trim()) e.nombre = 'Escribe el nombre.';
    let vPrecio: Centavos | undefined;
    let vCosto: Centavos | null | undefined;
    let vMinimo: Milesimas | null = null;
    if (puedePrecio) {
      try {
        vPrecio = leerDinero(precio);
      } catch (x) {
        e.precio = mensajeDe(x);
      }
      if (verCostos) {
        try {
          vCosto = costo.trim() ? leerDinero(costo) : null;
        } catch (x) {
          e.costo = mensajeDe(x);
        }
      }
    }
    try {
      vMinimo = minimo.trim() ? leerCantidad(minimo) : null;
    } catch (x) {
      e.minimo = mensajeDe(x);
    }
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    if (!producto) {
      let id = '';
      await op.correr(async () => {
        const datos: NuevoProducto = {
          nombre,
          categoria,
          unidad,
          precio: vPrecio ?? centavos(0),
          costo: vCosto ?? null,
          stockMinimo: vMinimo,
          codigo: codigo || null,
        };
        id = (await negocio.crearProducto(datos)).id;
      }, `«${nombre.trim()}» creado.`);
      if (id) alCerrar(id);
      return;
    }
    const cambios: { -readonly [K in keyof NuevoProducto]?: NuevoProducto[K] } = {};
    if (nombre.trim() !== producto.nombre) cambios.nombre = nombre;
    if ((categoria.trim() || 'Sin categoría') !== producto.categoria) cambios.categoria = categoria;
    if (unidad !== producto.unidad) cambios.unidad = unidad;
    if (vPrecio !== undefined && vPrecio !== producto.precio) cambios.precio = vPrecio;
    if (vCosto !== undefined && vCosto !== producto.costo) cambios.costo = vCosto;
    if (vMinimo !== producto.stockMinimo) cambios.stockMinimo = vMinimo;
    if (codigo.trim() !== (producto.codigo ?? '')) cambios.codigo = codigo;
    if (Object.keys(cambios).length === 0) return alCerrar();
    let listo = false;
    await op.correr(async () => {
      await negocio.editarProducto(producto.id, cambios);
      listo = true;
    }, 'Cambios guardados.');
    if (listo) alCerrar();
  }

  return (
    <Hoja
      titulo={producto ? `Editar ${producto.nombre}` : 'Nuevo producto'}
      alCerrar={() => alCerrar()}
      pie={<Pie etiqueta={producto ? 'Guardar' : 'Crear producto'} alCerrar={() => alCerrar()} alConfirmar={() => void guardar()} ocupado={op.ocupado} />}
    >
      <div class="inv-form">
        <CampoTexto etiqueta="Nombre" valor={nombre} alCambiar={setNombre} marcador="Ej.: Cerveza rubia 330 ml" error={errores.nombre} />
        <div class="inv-form__grupo">
          <CampoTexto etiqueta="Categoría" valor={categoria} alCambiar={setCategoria} marcador="Ej.: Bebidas" ayuda="Vacía: «Sin categoría»." />
          {sugeridas.length > 0 && (
            <GrupoChips etiqueta="Categorías existentes">
              {sugeridas.map((c) => (
                <Chip key={c} seleccionado={false} alCambiar={() => setCategoria(c)}>
                  {c}
                </Chip>
              ))}
            </GrupoChips>
          )}
        </div>
        <div class="inv-form__grupo">
          <p class="inv-form__etiqueta" id="inv-unidad">
            Unidad
          </p>
          <Segmentado
            etiqueta="Unidad"
            opciones={UNIDADES.map((u) => ({ valor: u, etiqueta: ABREV_UNIDAD[u] }))}
            valor={unidad}
            alCambiar={setUnidad}
          />
        </div>
        {puedePrecio && (
          <div class="inv-form__par">
            <CampoNumero etiqueta="Precio de venta" prefijo="$" valor={precio} alCambiar={setPrecio} marcador="8.500" error={errores.precio} />
            {verCostos && (
              <CampoNumero etiqueta="Costo" prefijo="$" valor={costo} alCambiar={setCosto} marcador="Opcional" error={errores.costo} />
            )}
          </div>
        )}
        <div class="inv-form__par">
          <CampoNumero
            etiqueta="Existencia mínima"
            sufijo={ABREV_UNIDAD[unidad]}
            valor={minimo}
            alCambiar={setMinimo}
            marcador="Opcional"
            ayuda="Avisa cuando quede esto o menos."
            error={errores.minimo}
          />
          <CampoTexto etiqueta="Código" valor={codigo} alCambiar={setCodigo} marcador="Opcional" />
        </div>
        <Aviso texto={op.error} />
      </div>
    </Hoja>
  );
}

// --- Contar ---------------------------------------------------------------------------

/** Conteo físico: escribes lo que hay; el núcleo guarda antes, después y la diferencia. */
export function HojaContar({ producto, alCerrar }: { producto: Producto; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  // Lo que se veía al empezar: si alguien vende mientras cuentas, el núcleo lo detecta
  const [antes] = useState(() => stockDe(estado, producto.id));
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const op = useOperacion(alCerrar);
  const u = ABREV_UNIDAD[producto.unidad];
  let diferencia: string | null = null;
  try {
    if (texto.trim()) {
      const d = leerCantidad(texto) - antes;
      diferencia = `${d > 0 ? '+' : ''}${mostrarCantidad(milesimas(d))} ${u}`;
    }
  } catch {
    diferencia = null;
  }
  const contar = () => {
    let contado: Milesimas;
    try {
      contado = leerCantidad(texto);
    } catch (e) {
      op.setError(mensajeDe(e));
      return;
    }
    void op.correr(() => negocio.contar(producto.id, contado, { nota, antesVisto: antes }), `Conteo de «${producto.nombre}» guardado.`);
  };
  return (
    <Hoja titulo={`Contar ${producto.nombre}`} alCerrar={alCerrar} pie={<Pie etiqueta="Guardar conteo" alCerrar={alCerrar} alConfirmar={contar} ocupado={op.ocupado} />}>
      <div class="inv-form">
        <p class="inv-form__dato">
          Según la app hay <strong class="cifras">{mostrarCantidad(antes)} {u}</strong>.
        </p>
        <CampoNumero etiqueta="¿Cuántas hay?" sufijo={u} valor={texto} alCambiar={setTexto} alConfirmar={contar} grande />
        {diferencia && (
          <p class="inv-form__dato" aria-live="polite">
            Diferencia: <strong class="cifras">{diferencia}</strong>
          </p>
        )}
        <CampoNota etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} marcador="Ej.: conteo del lunes" />
        <Aviso texto={op.error} />
      </div>
    </Hoja>
  );
}

// --- Merma / corrección -------------------------------------------------------------

type Motivo = 'merma' | 'consumo' | 'correccion';
const MOTIVOS: readonly { valor: Motivo; etiqueta: string }[] = [
  { valor: 'merma', etiqueta: 'Merma' },
  { valor: 'consumo', etiqueta: 'Consumo' },
  { valor: 'correccion', etiqueta: 'Corrección' },
];

/** Merma (se dañó, venció), consumo de la casa o corrección (sumar o restar), con nota. */
export function HojaAjuste({ producto, alCerrar }: { producto: Producto; alCerrar: () => void }) {
  const { negocio } = useNegocio();
  const [motivo, setMotivo] = useState<Motivo>('merma');
  const [sentido, setSentido] = useState<'restar' | 'sumar'>('restar');
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const op = useOperacion(alCerrar);
  const u = ABREV_UNIDAD[producto.unidad];
  const resta = motivo !== 'correccion' || sentido === 'restar';
  const guardar = () => {
    let q: Milesimas;
    try {
      q = leerCantidad(texto);
    } catch (e) {
      op.setError(mensajeDe(e));
      return;
    }
    if (q === 0) return op.setError('Escribe una cantidad mayor que cero.');
    if (motivo === 'correccion' && !nota.trim()) return op.setError('Una corrección lleva nota: explica qué pasó.');
    void op.correr(
      () => negocio.ajustarInventario({ productoId: producto.id, delta: milesimas(resta ? -q : q), motivo, nota }),
      'Ajuste guardado.',
    );
  };
  return (
    <Hoja titulo={`Ajustar ${producto.nombre}`} alCerrar={alCerrar} pie={<Pie etiqueta="Guardar ajuste" alCerrar={alCerrar} alConfirmar={guardar} ocupado={op.ocupado} />}>
      <div class="inv-form">
        <Segmentado etiqueta="Motivo" opciones={MOTIVOS} valor={motivo} alCambiar={setMotivo} />
        {motivo === 'correccion' && (
          <Segmentado
            etiqueta="Sentido"
            opciones={[
              { valor: 'restar', etiqueta: 'Restar' },
              { valor: 'sumar', etiqueta: 'Sumar' },
            ]}
            valor={sentido}
            alCambiar={setSentido}
          />
        )}
        <CampoNumero etiqueta={resta ? 'Cantidad que sale' : 'Cantidad que entra'} sufijo={u} valor={texto} alCambiar={setTexto} alConfirmar={guardar} />
        <CampoNota
          etiqueta={motivo === 'correccion' ? 'Nota' : 'Nota (opcional)'}
          valor={nota}
          alCambiar={setNota}
          marcador={motivo === 'merma' ? 'Ej.: se rompió una botella' : 'Ej.: se contó mal la factura'}
        />
        <Aviso texto={op.error} />
      </div>
    </Hoja>
  );
}
