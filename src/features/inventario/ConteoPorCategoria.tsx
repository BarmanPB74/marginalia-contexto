import { useMemo, useState } from 'preact/hooks';
import { leerCantidad, milesimas, mostrarCantidad, stockDe, type Milesimas, type Producto } from '../../core/negocio';
import { useEstado } from '../../app/estado';
import { Boton } from '../../ui/Boton';
import { CampoNumero } from '../../ui/CampoNumero';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';
import { useNegocio } from '../negocio/contexto';
import { ABREV_UNIDAD, ir, mensajeDe } from './comun';
import { enCopas, leerBotellasYCopas, textoExistencias } from './copas';
import { Aviso } from './formularios';
import { CampoNota } from './Selector';

/** Lo que se escribe por producto: cantidad, o botellas y copas si el producto se cuenta en copas. */
interface Escrito {
  cantidad: string;
  botellas: string;
  copas: string;
}
const VACIO: Escrito = { cantidad: '', botellas: '', copas: '' };

const vacio = (e: Escrito) => !e.cantidad.trim() && !e.botellas.trim() && !e.copas.trim();

function leer(e: Escrito, p: Producto): Milesimas {
  return p.copas ? leerBotellasYCopas(e.botellas, e.copas, p.copas) : leerCantidad(e.cantidad);
}

/**
 * Conteo por categoría (`#/inventario?conteo=<categoría>`): cuenta todo un grupo de una vez
 * (infusiones, siropes, galletas…), con el total del grupo en la app y el contado. Los que se
 * dejan en blanco no se tocan. Los descontinuados no entran. Se guarda todo junto (o nada).
 */
export function ConteoPorCategoria({ inicial }: { inicial: string }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const categorias = useMemo(
    () =>
      [...new Set(Object.values(estado.productos).filter((p) => p.activo && !p.descontinuado).map((p) => p.categoria))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [estado.productos],
  );
  const fotoDe = (c: string): Record<string, Milesimas> => {
    const fotos: Record<string, Milesimas> = {};
    for (const p of Object.values(estado.productos)) if (p.categoria === c) fotos[p.id] = stockDe(estado, p.id);
    return fotos;
  };
  const [categoria, setCategoria] = useState(categorias.includes(inicial) ? inicial : '');
  const [escritos, setEscritos] = useState<Record<string, Escrito>>({});
  // Lo que había al empezar a contar: si se vende mientras tanto, el núcleo lo detecta
  const [antes, setAntes] = useState<Record<string, Milesimas>>(() => fotoDe(categoria));
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const productos = Object.values(estado.productos)
    .filter((p) => p.activo && !p.descontinuado && p.categoria === categoria)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  function elegir(c: string) {
    setCategoria(c);
    setEscritos({});
    setError('');
    setAntes(fotoDe(c));
  }

  const antesDe = (p: Producto) => antes[p.id] ?? stockDe(estado, p.id);
  const cambiar = (id: string, c: Partial<Escrito>) => {
    setEscritos((x) => ({ ...x, [id]: { ...(x[id] ?? VACIO), ...c } }));
    setError('');
  };

  // Totales del grupo por unidad: en la app y contado (lo no contado cuenta como lo de la app)
  const totales = new Map<string, { app: number; contado: number; diferencia: number }>();
  let contados = 0;
  let invalidos = 0;
  for (const p of productos) {
    const u = ABREV_UNIDAD[p.unidad];
    const t = totales.get(u) ?? { app: 0, contado: 0, diferencia: 0 };
    const a = antesDe(p);
    let c = a;
    const e = escritos[p.id] ?? VACIO;
    if (!vacio(e)) {
      try {
        c = leer(e, p);
        contados++;
      } catch {
        invalidos++;
      }
    }
    totales.set(u, { app: t.app + a, contado: t.contado + c, diferencia: t.diferencia + (c - a) });
  }

  async function guardar() {
    const conteos: { productoId: string; contado: Milesimas; antesVisto: Milesimas }[] = [];
    for (const p of productos) {
      const e = escritos[p.id] ?? VACIO;
      if (vacio(e)) continue;
      try {
        conteos.push({ productoId: p.id, contado: leer(e, p), antesVisto: antesDe(p) });
      } catch (x) {
        setError(`${p.nombre}: ${x instanceof RangeError ? x.message : mensajeDe(x)}`);
        return;
      }
    }
    if (conteos.length === 0) {
      setError('Escribe al menos una cantidad contada.');
      return;
    }
    setOcupado(true);
    try {
      await negocio.contarVarios(conteos, nota || `Conteo de ${categoria}`);
      avisar(`Conteo de ${categoria} guardado (${conteos.length} ${conteos.length === 1 ? 'producto' : 'productos'}).`);
      ir('#/inventario');
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Conteo por categoría" accion={{ etiqueta: 'Volver', alTocar: () => ir('#/inventario') }} />
      {!negocio.puede('inventario.contar') ? (
        <EstadoVacio mensaje="Tu cargo no cuenta el inventario." pista="Lo hacen bodega y el dueño." />
      ) : categorias.length === 0 ? (
        <EstadoVacio mensaje="No hay productos para contar." pista="Crea o importa productos primero." />
      ) : (
        <div class="inv-conteo">
          <GrupoChips etiqueta="Categoría a contar">
            {categorias.map((c) => (
              <Chip key={c} seleccionado={categoria === c} alCambiar={() => elegir(c)}>
                {c}
              </Chip>
            ))}
          </GrupoChips>
          {!categoria ? (
            <p class="inv-suave">Elige la categoría que vas a contar (por ejemplo, infusiones, siropes o galletas).</p>
          ) : (
            <>
              <section class="inv-conteo__total" aria-label={`Total de ${categoria}`}>
                {[...totales].map(([u, t]) => (
                  <p key={u}>
                    <span>
                      En la app: <strong class="cifras">{mostrarCantidad(milesimas(t.app))} {u}</strong>
                    </span>
                    <span>
                      Contado: <strong class="cifras">{mostrarCantidad(milesimas(t.contado))} {u}</strong>
                    </span>
                    <span>
                      Diferencia:{' '}
                      <strong class="cifras">
                        {t.diferencia > 0 ? '+' : ''}
                        {mostrarCantidad(milesimas(t.diferencia))} {u}
                      </strong>
                    </span>
                  </p>
                ))}
                <p class="inv-suave">
                  {contados} de {productos.length} contados. Los que dejes en blanco no cambian.
                </p>
              </section>
              <ul class="inv-conteo__lista" aria-label={`Productos de ${categoria}`}>
                {productos.map((p) => {
                  const u = ABREV_UNIDAD[p.unidad];
                  const e = escritos[p.id] ?? VACIO;
                  let dif: string | null = null;
                  try {
                    if (!vacio(e)) {
                      const d = leer(e, p) - antesDe(p);
                      dif = p.copas
                        ? `${d > 0 ? '+' : ''}${enCopas(milesimas(d), p.copas).total} copas`
                        : `${d > 0 ? '+' : ''}${mostrarCantidad(milesimas(d))} ${u}`;
                    }
                  } catch {
                    dif = null;
                  }
                  return (
                    <li key={p.id} class="inv-conteo__fila">
                      <div class="inv-conteo__producto">
                        <strong>{p.nombre}</strong>
                        <span class="inv-suave">En la app: {textoExistencias(antesDe(p), p, u)}</span>
                        {dif && <span class="cifras">Diferencia: {dif}</span>}
                      </div>
                      {p.copas ? (
                        <div class="inv-conteo__campos">
                          <CampoNumero etiqueta={`Botellas de ${p.nombre}`} sufijo={u} valor={e.botellas} alCambiar={(v) => cambiar(p.id, { botellas: v })} />
                          <CampoNumero etiqueta={`Copas sueltas de ${p.nombre}`} sufijo="copas" valor={e.copas} alCambiar={(v) => cambiar(p.id, { copas: v })} />
                        </div>
                      ) : (
                        <div class="inv-conteo__campos">
                          <CampoNumero etiqueta={`Contado de ${p.nombre}`} sufijo={u} valor={e.cantidad} alCambiar={(v) => cambiar(p.id, { cantidad: v })} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <CampoNota etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} marcador={`Ej.: conteo de ${categoria} del lunes`} />
              {invalidos > 0 && <p class="inv-suave">Hay {invalidos} cantidades mal escritas: revísalas.</p>}
              <Aviso texto={error} />
              <div class="inv-pie">
                <Boton variante="texto" alTocar={() => ir('#/inventario')}>
                  Cancelar
                </Boton>
                <Boton variante="primario" icono="check" desactivado={ocupado} alTocar={() => void guardar()}>
                  {contados > 0 ? `Guardar conteo (${contados})` : 'Guardar conteo'}
                </Boton>
              </div>
            </>
          )}
        </div>
      )}
    </Pagina>
  );
}
