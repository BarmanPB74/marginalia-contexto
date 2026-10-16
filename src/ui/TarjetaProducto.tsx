import { categoriaDe, inicialesDe, type Categoria } from './categorias';
import { Icono, type NombreIcono } from './Icono';
import { Insignia } from './Insignia';
import './categorias.css';
import './TarjetaProducto.css';

export type EstadoExistencias = 'ok' | 'bajo' | 'agotado';

interface Props {
  nombre: string;
  /** Precio ya formateado por el núcleo ("$ 8.500") */
  precio: string;
  /** Existencias ya formateadas ("12 und", "1,5 kg") */
  existencias?: string | undefined;
  estado?: EstadoExistencias | undefined;
  /** Color de la categoría; por defecto, uno estable a partir de `nombreCategoria` o del nombre */
  color?: Categoria | undefined;
  nombreCategoria?: string | undefined;
  /** Foto (URL local o blob:) o icono; sin ninguno, la inicial del producto */
  imagen?: string | undefined;
  icono?: NombreIcono | undefined;
  /** Tocar la tarjeta (ver detalle, editar) */
  alTocar?: (() => void) | undefined;
  /** Botón + rápido (añadir al pedido, sumar existencias) */
  alAgregar?: (() => void) | undefined;
  etiquetaAgregar?: string | undefined;
  /** Unidades ya en el pedido: se muestra sobre el + */
  enPedido?: number | undefined;
}

const TEXTO_ESTADO: Record<EstadoExistencias, string> = { ok: 'Disponible', bajo: 'Bajo', agotado: 'Agotado' };
const TONO_ESTADO = { ok: 'exito', bajo: 'aviso', agotado: 'peligro' } as const;

/**
 * Tarjeta de producto para Vender e Inventario. Toda la tarjeta abre el detalle (enlace estirado)
 * y el + es un botón aparte, por encima, para que no haya botones anidados.
 */
export function TarjetaProducto({
  nombre,
  precio,
  existencias,
  estado,
  color,
  nombreCategoria,
  imagen,
  icono,
  alTocar,
  alAgregar,
  etiquetaAgregar = `Añadir ${nombre}`,
  enPedido,
}: Props) {
  const cat = color ?? categoriaDe(nombreCategoria ?? nombre);
  return (
    <article class={`tarjeta-producto cat-${cat}${estado === 'agotado' ? ' tarjeta-producto--agotado' : ''}`}>
      <div class="tarjeta-producto__media" aria-hidden="true">
        {imagen ? (
          <img class="tarjeta-producto__imagen" src={imagen} alt="" loading="lazy" decoding="async" />
        ) : icono ? (
          <Icono nombre={icono} tamano={40} />
        ) : (
          <span class="tarjeta-producto__inicial">{inicialesDe(nombre, 1)}</span>
        )}
      </div>
      <div class="tarjeta-producto__cuerpo">
        {nombreCategoria && <p class="tarjeta-producto__categoria">{nombreCategoria}</p>}
        <h3 class="tarjeta-producto__nombre">
          {alTocar ? (
            <button type="button" class="tarjeta-producto__abrir" onClick={alTocar}>
              {nombre}
            </button>
          ) : (
            nombre
          )}
        </h3>
        <p class="tarjeta-producto__precio cifras">{precio}</p>
        {(estado || existencias) && (
          <p class="tarjeta-producto__existencias">
            {estado && <Insignia tono={TONO_ESTADO[estado]}>{TEXTO_ESTADO[estado]}</Insignia>}
            {existencias && <span class="cifras">{existencias}</span>}
          </p>
        )}
      </div>
      {alAgregar && (
        <button type="button" class="tarjeta-producto__agregar" aria-label={etiquetaAgregar} onClick={alAgregar}>
          <Icono nombre="mas-signo" />
          {enPedido !== undefined && enPedido > 0 && (
            <span class="tarjeta-producto__cuenta cifras" aria-label={`${enPedido} en el pedido`}>
              {enPedido}
            </span>
          )}
        </button>
      )}
    </article>
  );
}
