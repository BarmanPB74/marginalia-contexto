import { useEffect, useState } from 'preact/hooks';
import { leerCantidad, mostrarCantidad, pesos, type Producto } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { CampoNumero } from '../../ui/CampoNumero';
import { Icono } from '../../ui/Icono';
import { Segmentado } from '../../ui/Segmentado';
import { unidadCorta } from '../caja/comun';
import { useNegocioOpcional } from '../negocio/contexto';
import { fijar, quitar, sumar, type LineaPedido, type Pedido as TPedido, type TipoDescuento, type VistaPrevia } from './pedido';

interface Props {
  pedido: TPedido;
  vista: VistaPrevia;
  alCambiar: (p: TPedido) => void;
  /** Muestra los botones Cobrar y Vaciar (en la hoja compacta van al pie) */
  conAcciones?: boolean | undefined;
  alCobrar: () => void;
}

const OPCIONES_DESCUENTO: ReadonlyArray<{ valor: TipoDescuento; etiqueta: string }> = [
  { valor: 'ninguno', etiqueta: 'Sin descuento' },
  { valor: 'porcentaje', etiqueta: '%' },
  { valor: 'valor', etiqueta: '$' },
];

/** El pedido: líneas con cantidades, descuento opcional y total (vista previa del núcleo). */
export function Pedido({ pedido, vista, alCambiar, conAcciones = true, alCobrar }: Props) {
  // Los descuentos los decide el dueño (permiso 'venta.descuento', NEGOCIO §4.2)
  const puedeDescontar = useNegocioOpcional()?.negocio.puede('venta.descuento') ?? true;
  if (vista.lineas.length === 0) {
    return (
      <div class="pedido pedido--vacio">
        <p class="pedido__vacio">El pedido está vacío.</p>
        <p class="pedido__pista">Toca un producto para añadirlo.</p>
      </div>
    );
  }
  return (
    <div class="pedido">
      <ul class="pedido__lineas" aria-label="Productos del pedido">
        {vista.lineas.map(({ linea, producto, subtotal }) => (
          <LineaDelPedido
            key={linea.productoId}
            linea={linea}
            producto={producto}
            subtotal={pesos(subtotal)}
            alCambiar={(cantidad) => alCambiar(fijar(pedido, linea.productoId, cantidad))}
            alSumar={(delta) => alCambiar(sumar(pedido, linea.productoId, delta))}
            alQuitar={() => alCambiar(quitar(pedido, linea.productoId))}
          />
        ))}
      </ul>

      {puedeDescontar && (
      <div class="pedido__descuento">
        <Segmentado
          etiqueta="Descuento"
          opciones={OPCIONES_DESCUENTO}
          valor={pedido.tipoDescuento}
          alCambiar={(tipoDescuento) => alCambiar({ ...pedido, tipoDescuento, textoDescuento: '' })}
        />
        {pedido.tipoDescuento !== 'ninguno' && (
          <CampoNumero
            etiqueta={pedido.tipoDescuento === 'porcentaje' ? 'Descuento en porcentaje' : 'Descuento en pesos'}
            valor={pedido.textoDescuento}
            alCambiar={(textoDescuento) => alCambiar({ ...pedido, textoDescuento })}
            prefijo={pedido.tipoDescuento === 'valor' ? '$' : undefined}
            sufijo={pedido.tipoDescuento === 'porcentaje' ? '%' : undefined}
            error={vista.errorDescuento ?? undefined}
          />
        )}
      </div>
      )}

      <dl class="pedido__totales">
        {vista.descuento > 0 && (
          <>
            <div class="pedido__fila">
              <dt>Subtotal</dt>
              <dd class="cifras">{pesos(vista.bruto)}</dd>
            </div>
            <div class="pedido__fila">
              <dt>Descuento</dt>
              <dd class="cifras">−{pesos(vista.descuento)}</dd>
            </div>
          </>
        )}
        <div class="pedido__fila pedido__fila--total">
          <dt>Total</dt>
          <dd class="cifras">{pesos(vista.total)}</dd>
        </div>
      </dl>

      {conAcciones && (
        <div class="pedido__acciones">
          <Boton variante="primario" ancho icono="caja" desactivado={vista.errorDescuento !== null} alTocar={alCobrar}>
            Cobrar {pesos(vista.total)}
          </Boton>
          <Boton variante="texto" ancho icono="papelera" alTocar={() => alCambiar({ ...pedido, lineas: [] })}>
            Vaciar pedido
          </Boton>
        </div>
      )}
    </div>
  );
}

interface PropsLinea {
  linea: LineaPedido;
  producto: Producto;
  subtotal: string;
  alCambiar: (cantidad: ReturnType<typeof leerCantidad>) => void;
  alSumar: (delta: number) => void;
  alQuitar: () => void;
}

function LineaDelPedido({ linea, producto, subtotal, alCambiar, alSumar, alQuitar }: PropsLinea) {
  const porUnidad = producto.unidad === 'unidad';
  return (
    <li class="pedido__linea">
      <div class="pedido__cabeza">
        <span class="pedido__nombre">{producto.nombre}</span>
        <span class="pedido__subtotal cifras">{subtotal}</span>
      </div>
      <p class="pedido__unitario cifras">
        {pesos(producto.precio)} / {unidadCorta(producto.unidad)}
      </p>
      <div class="pedido__controles">
        {porUnidad ? (
          <div class="pedido__cantidad" role="group" aria-label={`Cantidad de ${producto.nombre}`}>
            <button type="button" class="pedido__paso" aria-label={`Uno menos de ${producto.nombre}`} onClick={() => alSumar(-1000)}>
              <Icono nombre="menos" />
            </button>
            <span class="pedido__numero cifras" aria-live="polite">
              {mostrarCantidad(linea.cantidad)}
            </span>
            <button type="button" class="pedido__paso" aria-label={`Uno más de ${producto.nombre}`} onClick={() => alSumar(1000)}>
              <Icono nombre="mas-signo" />
            </button>
          </div>
        ) : (
          <CantidadEscrita linea={linea} producto={producto} alCambiar={alCambiar} />
        )}
        <button type="button" class="pedido__quitar" aria-label={`Quitar ${producto.nombre}`} onClick={alQuitar}>
          <Icono nombre="cerrar" />
        </button>
      </div>
    </li>
  );
}

/** Productos por peso o volumen: la cantidad se escribe (1,25 kg). Se aplica al ser válida. */
function CantidadEscrita({ linea, producto, alCambiar }: Pick<PropsLinea, 'linea' | 'producto' | 'alCambiar'>) {
  const [texto, setTexto] = useState(mostrarCantidad(linea.cantidad));
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    // Si cambió desde fuera (tocaron la tarjeta otra vez), se muestra lo nuevo
    setTexto((t) => {
      try {
        return leerCantidad(t) === linea.cantidad ? t : mostrarCantidad(linea.cantidad);
      } catch {
        return t;
      }
    });
  }, [linea.cantidad]);
  return (
    <CampoNumero
      etiqueta={`Cantidad de ${producto.nombre}`}
      valor={texto}
      sufijo={unidadCorta(producto.unidad)}
      error={error}
      alCambiar={(t) => {
        setTexto(t);
        try {
          const q = leerCantidad(t);
          if (q <= 0) throw new RangeError('La cantidad debe ser mayor que cero.');
          setError(undefined);
          alCambiar(q);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Cantidad inválida.');
        }
      }}
    />
  );
}
