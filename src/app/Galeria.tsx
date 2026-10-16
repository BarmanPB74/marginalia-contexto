/*
 * Galería interna del sistema de diseño de Bar Box: todos los componentes en una pantalla, para
 * revisarlos de un vistazo en cada tamaño (tests/e2e/pantallas.spec.ts la recorre). No se enlaza
 * desde la app; se abre con #/galeria. Los datos son de ejemplo.
 */
import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { Avatar, BotonUsuario } from '../ui/Avatar';
import { BarraInferior } from '../ui/BarraInferior';
import { Boton } from '../ui/Boton';
import { BotonFlotante } from '../ui/BotonFlotante';
import { Buscador } from '../ui/Buscador';
import { CampoNumero } from '../ui/CampoNumero';
import { CampoTexto } from '../ui/CampoTexto';
import { Casilla } from '../ui/Casilla';
import { CATEGORIAS, type Categoria } from '../ui/categorias';
import { CeldaDia } from '../ui/CeldaDia';
import { Chip, ChipFiltro, GrupoChips } from '../ui/Chip';
import { Cifra } from '../ui/Cifra';
import { Conmutador } from '../ui/Conmutador';
import { Dialogo } from '../ui/Dialogo';
import { Disposicion, Rejilla } from '../ui/Disposicion';
import { Encabezado } from '../ui/Encabezado';
import { EstadoVacio } from '../ui/EstadoVacio';
import { Etiqueta } from '../ui/Etiqueta';
import { Hoja } from '../ui/Hoja';
import { Icono, NOMBRES_ICONO } from '../ui/Icono';
import { Insignia } from '../ui/Insignia';
import { Interruptor } from '../ui/Interruptor';
import { MuestraColor, type OpcionColor } from '../ui/MuestraColor';
import { Pagina } from '../ui/Pagina';
import { Pestanas } from '../ui/Pestanas';
import { Rango } from '../ui/Rango';
import { Segmentado } from '../ui/Segmentado';
import { Tabla, type Columna } from '../ui/Tabla';
import { Tarjeta } from '../ui/Tarjeta';
import { TarjetaProducto, type EstadoExistencias } from '../ui/TarjetaProducto';
import { TecladoNumerico } from '../ui/TecladoNumerico';
import { TecladoPin } from '../ui/TecladoPin';
import './Galeria.css';

function Muestra({ nombre, children }: { nombre: string; children: ComponentChildren }) {
  return (
    <section class="muestra" aria-labelledby={`muestra-${nombre}`}>
      <h2 class="muestra__nombre" id={`muestra-${nombre}`}>
        {nombre}
      </h2>
      <div class="muestra__contenido">{children}</div>
    </section>
  );
}

/** Formato de ejemplo (el de verdad vive en el núcleo): $ 12.500 */
const pesos = (n: number) => `$ ${n.toLocaleString('es-CO')}`;

interface ProductoEjemplo {
  nombre: string;
  categoria: string;
  color: Categoria;
  precio: number;
  existencias: string;
  estado: EstadoExistencias;
}

const PRODUCTOS: ProductoEjemplo[] = [
  { nombre: 'Café americano', categoria: 'Calientes', color: 'ambar', precio: 4500, existencias: '42 und', estado: 'ok' },
  { nombre: 'Capuchino', categoria: 'Calientes', color: 'ambar', precio: 7000, existencias: '6 und', estado: 'bajo' },
  { nombre: 'Cerveza artesanal', categoria: 'Cervezas', color: 'coral', precio: 12000, existencias: '24 und', estado: 'ok' },
  { nombre: 'Agua con gas', categoria: 'Frías', color: 'cielo', precio: 3500, existencias: '0 und', estado: 'agotado' },
  { nombre: 'Limonada de coco', categoria: 'Frías', color: 'turquesa', precio: 9500, existencias: '3 L', estado: 'bajo' },
  { nombre: 'Empanada', categoria: 'Comida', color: 'esmeralda', precio: 3000, existencias: '30 und', estado: 'ok' },
  { nombre: 'Torta de chocolate', categoria: 'Postres', color: 'fucsia', precio: 8500, existencias: '8 und', estado: 'ok' },
  { nombre: 'Sándwich', categoria: 'Comida', color: 'esmeralda', precio: 14000, existencias: '1 und', estado: 'bajo' },
];

const CATEGORIAS_FILTRO = ['Calientes', 'Frías', 'Cervezas', 'Comida', 'Postres'];
const ESTADOS: { valor: EstadoExistencias; etiqueta: string }[] = [
  { valor: 'ok', etiqueta: 'Disponible' },
  { valor: 'bajo', etiqueta: 'Bajo' },
  { valor: 'agotado', etiqueta: 'Agotado' },
];
const COLORES: OpcionColor<string>[] = [
  { valor: 'oscuro', nombre: 'Negro', color: 'oscuro' },
  { valor: 'claro', nombre: 'Blanco', color: 'claro' },
  { valor: 'cielo', nombre: 'Azul', color: 'cielo' },
  { valor: 'coral', nombre: 'Rojo', color: 'coral' },
  { valor: 'esmeralda', nombre: 'Verde', color: 'esmeralda' },
];

interface Venta {
  id: string;
  hora: string;
  producto: string;
  cantidad: number;
  total: number;
  forma: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

const VENTAS: Venta[] = [
  { id: 'v1', hora: '09:12', producto: 'Café americano', cantidad: 2, total: 9000, forma: 'Efectivo' },
  { id: 'v2', hora: '09:40', producto: 'Capuchino', cantidad: 1, total: 7000, forma: 'Tarjeta' },
  { id: 'v3', hora: '10:05', producto: 'Empanada', cantidad: 4, total: 12000, forma: 'Transferencia' },
  { id: 'v4', hora: '10:31', producto: 'Torta de chocolate', cantidad: 1, total: 8500, forma: 'Efectivo' },
];

const TONO_FORMA = { Efectivo: 'exito', Tarjeta: 'info', Transferencia: 'primario' } as const;

const COLUMNAS: Columna<Venta>[] = [
  { clave: 'producto', titulo: 'Producto', principal: true, celda: (v) => v.producto },
  { clave: 'hora', titulo: 'Hora', celda: (v) => <span class="cifras">{v.hora}</span> },
  { clave: 'cantidad', titulo: 'Cant.', numerica: true, celda: (v) => v.cantidad },
  { clave: 'total', titulo: 'Total', numerica: true, celda: (v) => pesos(v.total) },
  { clave: 'forma', titulo: 'Pago', celda: (v) => <Insignia tono={TONO_FORMA[v.forma]}>{v.forma}</Insignia> },
];

// Una semana de ejemplo: [día, notas, hoy, fuera de mes]
const SEMANA: [number, number, boolean, boolean][] = [
  [29, 0, false, true],
  [30, 1, false, true],
  [1, 0, false, false],
  [2, 2, true, false],
  [3, 0, false, false],
  [4, 5, false, false],
  [5, 1, false, false],
];

function Filtros(props: {
  precio: [number, number];
  setPrecio: (p: [number, number]) => void;
  categorias: string[];
  alternarCategoria: (c: string) => void;
  estados: EstadoExistencias[];
  alternarEstado: (e: EstadoExistencias) => void;
  color: string | null;
  setColor: (c: string) => void;
  soloExistencias: boolean;
  setSoloExistencias: (v: boolean) => void;
  buscarCategoria: string;
  setBuscarCategoria: (v: string) => void;
}) {
  const visibles = CATEGORIAS_FILTRO.filter((c) => c.toLowerCase().includes(props.buscarCategoria.trim().toLowerCase()));
  return (
    <>
      <Rango
        etiqueta="Precio"
        min={0}
        max={20000}
        paso={500}
        valorMin={props.precio[0]}
        valorMax={props.precio[1]}
        prefijo="$"
        formatear={pesos}
        alCambiar={(a, b) => props.setPrecio([a, b])}
      />
      <div class="galeria-filtro">
        <h3 class="galeria-filtro__titulo">Categoría</h3>
        <Buscador etiqueta="Buscar categorías" valor={props.buscarCategoria} alCambiar={props.setBuscarCategoria} />
        <div class="galeria-casillas">
          {visibles.map((c) => (
            <Casilla
              key={c}
              etiqueta={c}
              contador={PRODUCTOS.filter((p) => p.categoria === c).length}
              marcada={props.categorias.includes(c)}
              alCambiar={() => props.alternarCategoria(c)}
            />
          ))}
        </div>
      </div>
      <div class="galeria-filtro">
        <h3 class="galeria-filtro__titulo">Existencias</h3>
        <GrupoChips etiqueta="Estado de existencias">
          {ESTADOS.map((e) => (
            <Chip key={e.valor} seleccionado={props.estados.includes(e.valor)} alCambiar={() => props.alternarEstado(e.valor)}>
              {e.etiqueta}
            </Chip>
          ))}
        </GrupoChips>
      </div>
      <div class="galeria-filtro">
        <h3 class="galeria-filtro__titulo">Color</h3>
        <MuestraColor etiqueta="Color" opciones={COLORES} valor={props.color} alCambiar={props.setColor} />
      </div>
      <div class="galeria-filtro">
        <h3 class="galeria-filtro__titulo">Disponibilidad</h3>
        <Conmutador etiqueta="Solo con existencias" activo={props.soloExistencias} alCambiar={props.setSoloExistencias} />
      </div>
    </>
  );
}

export function Galeria() {
  const [titulo, setTitulo] = useState('');
  const [lectura, setLectura] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [vista, setVista] = useState<'tarjetas' | 'lista'>('tarjetas');
  const [pestana, setPestana] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [precioTexto, setPrecioTexto] = useState('8500');
  const [cantidadTexto, setCantidadTexto] = useState('1,5');
  const [busqueda, setBusqueda] = useState('');
  const [monto, setMonto] = useState('');
  const [pin, setPin] = useState('');
  const [errorPin, setErrorPin] = useState<string>();
  const [usuario, setUsuario] = useState('Ana María');
  const [dialogo, setDialogo] = useState(false);
  const [hoja, setHoja] = useState(false);
  const [pedido, setPedido] = useState<Record<string, number>>({});

  // Filtros de la disposición
  const [precio, setPrecio] = useState<[number, number]>([0, 20000]);
  const [categorias, setCategorias] = useState<string[]>(['Calientes', 'Comida']);
  const [estados, setEstados] = useState<EstadoExistencias[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [soloExistencias, setSoloExistencias] = useState(false);
  const [buscarCategoria, setBuscarCategoria] = useState('');
  const alternar = <T,>(lista: T[], x: T) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

  const productos = useMemo(
    () =>
      PRODUCTOS.filter(
        (p) =>
          p.precio >= precio[0] &&
          p.precio <= precio[1] &&
          (categorias.length === 0 || categorias.includes(p.categoria)) &&
          (estados.length === 0 || estados.includes(p.estado)) &&
          (!soloExistencias || p.estado !== 'agotado'),
      ),
    [precio, categorias, estados, soloExistencias],
  );
  const precioActivo = precio[0] > 0 || precio[1] < 20000;
  const activos = categorias.length + estados.length + (precioActivo ? 1 : 0) + (soloExistencias ? 1 : 0) + (color ? 1 : 0);
  const quitarTodo = () => {
    setPrecio([0, 20000]);
    setCategorias([]);
    setEstados([]);
    setColor(null);
    setSoloExistencias(false);
  };

  return (
    <>
      <Pagina ancho="amplio">
        <Encabezado
          titulo="Galería"
          iconos={[{ icono: 'buscar', etiqueta: 'Buscar', alTocar: () => undefined }]}
          accion={{ etiqueta: 'Volver', alTocar: () => (location.hash = '#/notas') }}
        />

        <Muestra nombre="Disposicion">
          <Disposicion
            activos={activos}
            panel={
              <Filtros
                precio={precio}
                setPrecio={setPrecio}
                categorias={categorias}
                alternarCategoria={(c) => setCategorias((l) => alternar(l, c))}
                estados={estados}
                alternarEstado={(e) => setEstados((l) => alternar(l, e))}
                color={color}
                setColor={setColor}
                soloExistencias={soloExistencias}
                setSoloExistencias={setSoloExistencias}
                buscarCategoria={buscarCategoria}
                setBuscarCategoria={setBuscarCategoria}
              />
            }
            piePanel={
              <Boton variante="primario" ancho>
                Ver {productos.length} productos
              </Boton>
            }
            barra={<Buscador etiqueta="Buscar productos" valor={busqueda} alCambiar={setBusqueda} />}
          >
            {activos > 0 && (
              <div class="galeria-activos">
                <p class="galeria-activos__titulo">Filtros activos</p>
                <GrupoChips etiqueta="Filtros activos">
                  {precioActivo && <ChipFiltro alQuitar={() => setPrecio([0, 20000])}>{`${pesos(precio[0])} – ${pesos(precio[1])}`}</ChipFiltro>}
                  {categorias.map((c) => (
                    <ChipFiltro key={c} alQuitar={() => setCategorias((l) => l.filter((x) => x !== c))}>
                      {c}
                    </ChipFiltro>
                  ))}
                  {estados.map((e) => (
                    <ChipFiltro key={e} alQuitar={() => setEstados((l) => l.filter((x) => x !== e))}>
                      {ESTADOS.find((x) => x.valor === e)?.etiqueta ?? e}
                    </ChipFiltro>
                  ))}
                  {soloExistencias && <ChipFiltro alQuitar={() => setSoloExistencias(false)}>Con existencias</ChipFiltro>}
                  {color && <ChipFiltro alQuitar={() => setColor(null)}>{COLORES.find((c) => c.valor === color)?.nombre ?? color}</ChipFiltro>}
                  <Boton variante="texto" alTocar={quitarTodo}>
                    Quitar todo
                  </Boton>
                </GrupoChips>
              </div>
            )}
            <Rejilla etiqueta="Productos">
              {productos.map((p) => (
                <TarjetaProducto
                  key={p.nombre}
                  nombre={p.nombre}
                  nombreCategoria={p.categoria}
                  color={p.color}
                  precio={pesos(p.precio)}
                  existencias={p.existencias}
                  estado={p.estado}
                  enPedido={pedido[p.nombre] ?? 0}
                  alTocar={() => undefined}
                  alAgregar={() => setPedido((x) => ({ ...x, [p.nombre]: (x[p.nombre] ?? 0) + 1 }))}
                />
              ))}
            </Rejilla>
            {productos.length === 0 && <EstadoVacio mensaje="Ningún producto con esos filtros." pista="Quita alguno para ver más." />}
          </Disposicion>
        </Muestra>

        <Muestra nombre="Cifra">
          <Rejilla tipo="cifra">
            <Cifra etiqueta="Ventas de hoy" icono="vender" valor={pesos(1250000)} variacion="+12 %" tendencia="sube" detalle="frente a ayer" />
            <Cifra etiqueta="Gastos del mes" icono="gasto" color="coral" valor={pesos(386500)} variacion="+8 %" tendencia="sube" subirEsBueno={false} />
            <Cifra etiqueta="Productos bajos" icono="inventario" color="ambar" valor="7" variacion="−2" tendencia="baja" subirEsBueno={false} />
            <Cifra etiqueta="Tickets" icono="factura" color="cielo" valor="38" variacion="igual" />
          </Rejilla>
        </Muestra>

        <Muestra nombre="Paleta">
          <div class="galeria-paleta">
            {CATEGORIAS.map((c) => (
              <span key={c} class={`galeria-paleta__muestra cat-${c}`}>
                <span class="galeria-paleta__base" aria-hidden="true" />
                {c}
              </span>
            ))}
          </div>
          <div class="galeria-fila">
            <Insignia tono="exito" icono="check">Éxito</Insignia>
            <Insignia tono="aviso" icono="alerta">Aviso</Insignia>
            <Insignia tono="peligro" icono="alerta">Peligro</Insignia>
            <Insignia tono="info">Info</Insignia>
          </div>
        </Muestra>

        <Muestra nombre="Tipografía">
          <p class="galeria-titulo">Cierre de caja · viernes</p>
          <p>
            El turno de la tarde vendió <strong>38 tickets</strong>; la <em>limonada de coco</em> se agotó a las 6.
            Revisar <mark>el pedido de café</mark> y anotar dudas en <a href="#/galeria">la bitácora</a>.
          </p>
          <p class="galeria-secundario">Texto secundario · hace 5 min</p>
          <p class="galeria-monto cifras">$ 1.250.000</p>
          <p>
            <code>iva = 19</code>
          </p>
        </Muestra>

        <Muestra nombre="Icono">
          <div class="galeria-iconos">
            {NOMBRES_ICONO.map((nombre) => (
              <span key={nombre} class="galeria-icono" title={nombre}>
                <Icono nombre={nombre} tamano={28} />
                <span class="galeria-icono__nombre">{nombre}</span>
              </span>
            ))}
          </div>
        </Muestra>

        <Muestra nombre="Boton">
          <div class="galeria-fila">
            <Boton variante="primario" icono="check">
              Cobrar
            </Boton>
            <Boton>Guardar</Boton>
            <Boton variante="tonal" icono="importar">
              Importar
            </Boton>
            <Boton variante="texto">Cancelar</Boton>
            <Boton variante="peligro" icono="papelera" alTocar={() => setDialogo(true)}>
              Anular venta
            </Boton>
            <Boton desactivado>Desactivado</Boton>
          </div>
        </Muestra>

        <Muestra nombre="Chip">
          <GrupoChips etiqueta="Tamaño">
            {['Pequeño', 'Mediano', 'Grande'].map((t) => (
              <Chip key={t} seleccionado={t === 'Mediano'} alCambiar={() => undefined}>
                {t}
              </Chip>
            ))}
            <Chip seleccionado color="fucsia" contador={4} alCambiar={() => undefined}>
              Postres
            </Chip>
            <ChipFiltro alQuitar={() => undefined}>Café</ChipFiltro>
          </GrupoChips>
        </Muestra>

        <Muestra nombre="Etiqueta">
          <div class="galeria-fila">
            <Etiqueta tipo="fecha">@ 12 oct</Etiqueta>
            <Etiqueta>estudio</Etiqueta>
            <Etiqueta color="esmeralda">Comida</Etiqueta>
            <Etiqueta color="cielo">Frías</Etiqueta>
          </div>
        </Muestra>

        <Muestra nombre="Tarjeta">
          <div class="galeria-columnas">
            <Tarjeta>
              <p class="galeria-titulo">Pedido a proveedor</p>
              <p class="galeria-secundario">3 productos · llega el lunes</p>
            </Tarjeta>
            <Tarjeta variante="hundida">
              <p class="galeria-titulo">Efectivo esperado</p>
              <p class="galeria-monto cifras">$ 482.000</p>
            </Tarjeta>
          </div>
        </Muestra>

        <Muestra nombre="CampoTexto">
          <div class="galeria-columnas">
            <CampoTexto etiqueta="Nombre del producto" valor={titulo} alCambiar={setTitulo} marcador="Ej.: Café americano" />
            <CampoTexto etiqueta="Proveedor" valor="" alCambiar={() => undefined} error="Escribe el proveedor." />
          </div>
        </Muestra>

        <Muestra nombre="CampoNumero">
          <div class="galeria-columnas">
            <CampoNumero etiqueta="Precio de venta" prefijo="$" valor={precioTexto} alCambiar={setPrecioTexto} ayuda="Con IVA incluido" />
            <CampoNumero etiqueta="Cantidad" sufijo="kg" valor={cantidadTexto} alCambiar={setCantidadTexto} />
          </div>
        </Muestra>

        <Muestra nombre="Buscador">
          <Buscador etiqueta="Buscar en el inventario" valor={busqueda} alCambiar={setBusqueda} />
        </Muestra>

        <Muestra nombre="Casilla">
          <Casilla etiqueta="Incluir propina" marcada={lectura} alCambiar={setLectura} />
          <Casilla etiqueta="Cervezas" contador={24} marcada={false} alCambiar={() => undefined} />
          <Casilla etiqueta="Todas las categorías" indeterminada marcada={false} alCambiar={() => undefined} />
        </Muestra>

        <Muestra nombre="Rango">
          <Rango etiqueta="Existencias" min={0} max={100} valorMin={10} valorMax={60} sufijo="und" alCambiar={() => undefined} />
        </Muestra>

        <Muestra nombre="MuestraColor">
          <MuestraColor
            etiqueta="Color de la categoría"
            opciones={CATEGORIAS.map((c) => ({ valor: c, nombre: c, color: c }))}
            valor={color && (CATEGORIAS as readonly string[]).includes(color) ? color : 'indigo'}
            alCambiar={setColor}
          />
        </Muestra>

        <Muestra nombre="Interruptor">
          <Interruptor etiqueta="Abrir notas en modo lectura" activo={lectura} alCambiar={setLectura} />
          <Conmutador
            etiqueta="Ejemplo apagado"
            descripcion="El conmutador es el mismo componente"
            activo={sinConexion}
            alCambiar={setSinConexion}
          />
        </Muestra>

        <Muestra nombre="Segmentado">
          <Segmentado
            etiqueta="Vista"
            opciones={[
              { valor: 'tarjetas', etiqueta: 'Tarjetas' },
              { valor: 'lista', etiqueta: 'Lista' },
            ]}
            valor={vista}
            alCambiar={setVista}
          />
        </Muestra>

        <Muestra nombre="Pestanas">
          <Pestanas
            etiqueta="Periodo"
            pestanas={[
              { id: 'hoy', etiqueta: 'Hoy', contador: 38 },
              { id: 'semana', etiqueta: 'Semana' },
              { id: 'mes', etiqueta: 'Mes' },
            ]}
            actual={pestana}
            alCambiar={setPestana}
          >
            <p class="galeria-secundario">Ventas de: {pestana}</p>
          </Pestanas>
        </Muestra>

        <Muestra nombre="Tabla">
          <Tabla titulo="Ventas de hoy" verTitulo columnas={COLUMNAS} filas={VENTAS} claveFila={(v) => v.id} alTocarFila={() => undefined} />
        </Muestra>

        <Muestra nombre="TecladoNumerico">
          <div class="galeria-caja">
            <p class="galeria-monto cifras" aria-live="polite">
              $ {monto || '0'}
            </p>
            <TecladoNumerico valor={monto} alCambiar={setMonto} alConfirmar={() => setMonto('')} etiquetaConfirmar="Cobrar" />
          </div>
        </Muestra>

        <Muestra nombre="Avatar">
          <div class="galeria-fila">
            <Avatar nombre="Ana María" tamano="s" />
            <Avatar nombre="Luis" />
            <Avatar nombre="Sofía Ríos" tamano="l" />
          </div>
          <div class="galeria-usuarios">
            {[
              ['Ana María', 'Dueña'],
              ['Luis', 'Cajero'],
              ['Sofía Ríos', 'Bodega'],
            ].map(([nombre = '', rol]) => (
              <BotonUsuario key={nombre} nombre={nombre} rol={rol} seleccionado={usuario === nombre} alTocar={() => setUsuario(nombre)} />
            ))}
          </div>
        </Muestra>

        <Muestra nombre="TecladoPin">
          <TecladoPin
            etiqueta={`Hola, ${usuario}. Escribe tu PIN`}
            valor={pin}
            alCambiar={(v) => {
              setPin(v);
              if (v) setErrorPin(undefined);
            }}
            alCompletar={(v) => {
              setPin('');
              setErrorPin(v === '1234' ? undefined : 'PIN incorrecto. Prueba 1234.');
            }}
            error={errorPin}
            accion={{ etiqueta: 'Cambiar usuario', icono: 'usuarios', alTocar: () => setPin('') }}
          />
        </Muestra>

        <Muestra nombre="Dialogo">
          <div class="galeria-fila">
            <Boton alTocar={() => setDialogo(true)}>Abrir diálogo</Boton>
            <Boton alTocar={() => setHoja(true)}>Abrir hoja</Boton>
          </div>
        </Muestra>

        <Muestra nombre="BotonFlotante">
          <div class="galeria-fila">
            <BotonFlotante etiqueta="Nueva venta" fijo={false} alTocar={() => undefined} />
            <BotonFlotante etiqueta="Nuevo producto" extendido fijo={false} alTocar={() => undefined} />
          </div>
        </Muestra>

        <Muestra nombre="CeldaDia">
          <div class="galeria-semana">
            {SEMANA.map(([dia, notas, hoy, fuera]) => (
              <CeldaDia key={`${dia}-${fuera}`} dia={dia} notas={notas} hoy={hoy} fuera={fuera} />
            ))}
          </div>
        </Muestra>

        <Muestra nombre="EstadoVacio">
          <EstadoVacio mensaje="Aún no hay gastos." pista="Los gastos del mes aparecerán aquí." />
        </Muestra>
      </Pagina>

      <BarraInferior />

      {dialogo && (
        <Dialogo
          titulo="¿Anular esta venta?"
          peligro
          etiquetaConfirmar="Anular"
          alConfirmar={() => setDialogo(false)}
          alCerrar={() => setDialogo(false)}
        >
          <p>Se devolverán 2 cafés al inventario y el ticket quedará marcado como anulado.</p>
        </Dialogo>
      )}
      {hoja && (
        <Hoja
          titulo="Detalle del ticket"
          alCerrar={() => setHoja(false)}
          pie={
            <Boton variante="primario" ancho alTocar={() => setHoja(false)}>
              Listo
            </Boton>
          }
        >
          <p>Ticket 0038 · 2 × Café americano · {pesos(9000)}</p>
        </Hoja>
      )}
    </>
  );
}
