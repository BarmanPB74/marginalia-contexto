# DISEÑO — Stark

> **2026-10-16, pedido del dueño:** la app pasa de «Marginalia» (notas en papel dibujado) a **Stark**,
> inventario y ventas de un café/bar. Estilo **soft UI** claro y ordenado, **colores vívidos**, que funcione
> en **todos los tamaños de pantalla** y que **todo se lea**, también con la letra del sistema al 200 %.
> Las notas y el calendario siguen como **Bitácora** con el mismo sistema (los tokens viejos son alias).

La imagen de referencia del dueño es solo inspiración: **no se copia ni se sube al repo**.
El catálogo vivo de todo lo de abajo está en **`#/galeria`** (`src/app/Galeria.tsx`).

## Principios

1. **Ordenado antes que decorado.** Una acción principal por pantalla (botón primario o `BotonFlotante`). Lo demás, secundario.
2. **Profundidad suave, no ruido.** Las superficies se levantan con dos sombras (luz arriba-izquierda, sombra abajo-derecha);
   lo que se escribe se hunde. Nada de degradados ni bordes gruesos.
3. **Color con significado.** El índigo es acción. Los 7 colores categóricos distinguen categorías y personas.
   Verde, ámbar, rojo y azul son estados. Ningún color es la única pista: siempre hay texto o icono.
4. **Legible siempre.** Contraste medido por prueba, cuerpo ≥ 16 px, nada < 13 px, todo en `rem` para crecer con el sistema.
5. **Cifras que cuadran.** Dinero y cantidades con `tabular-nums` (clase `.cifras`). El núcleo formatea y valida; la UI solo muestra texto.
6. **Un dedo, una mano.** Objetivos táctiles ≥ 48 px; acciones frecuentes abajo en teléfonos.

## Tokens (`src/ui/tokens.css`, única fuente de colores)

Ningún otro archivo de `src/` escribe un color literal (`tests/unit/tokens.test.ts` lo vigila). El tema oscuro sigue a
`prefers-color-scheme` salvo que Ajustes fije `data-tema` en `<html>`; vive dos veces en `tokens.css` y la prueba exige
que sean idénticos.

### Superficies y texto

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--fondo` | `#E8ECF4` | `#131722` | Fondo de la app (gris azulado) |
| `--superficie` | `#F3F5FA` | `#1B2030` | Paneles, tarjetas, barra (con `--sombra`) |
| `--superficie-alta` | `#FAFBFD` | `#222839` | Lo que va encima de un panel (opción elegida, manijas) |
| `--hundido` | `#E1E6EF` | `#0E121B` | Campos, pistas, segmentados (con `--sombra-hundida`) |
| `--texto` | `#121A33` | `#EEF1FA` | Texto principal (≥ 7:1 en toda superficie) |
| `--texto-2` | `#4A5372` | `#ADB4CC` | Texto secundario (≥ 4.5:1) |
| `--borde` / `--borde-fuerte` | tinta 7 % / 32 % | tinta 7 % / 34 % | Canto de tarjetas / contorno de controles |

### Primario (índigo eléctrico)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--primario` | `#4B3FE0` | `#8C84FF` | Relleno del botón principal, elegido, progreso |
| `--sobre-primario` | `#FFFFFF` | `#110D33` | Texto sobre `--primario` |
| `--primario-tinta` | `#3A2FC0` | `#B3ADFF` | Enlaces, botón de texto, sección actual |
| `--primario-suave` | `#E2E0FF` | `#2C2866` | Chips de filtro, tonal |

### Paleta categórica (base · suave · tinta)

Base = relleno vívido (puntos, muestras); **nunca lleva texto encima ni es texto**. Suave = fondo. Tinta = texto legible
sobre su suave **y** sobre cualquier superficie. En código: `Categoria` y `CATEGORIAS` de `src/ui/categorias.ts`;
`categoriaDe(texto)` da un color estable; la clase `.cat-<color>` fija `--cat-base/--cat-suave/--cat-tinta`.

| Color | Base (claro / oscuro) | Suave | Tinta |
|---|---|---|---|
| índigo | `#5B4CF0` / `#8C84FF` | `#E4E1FF` / `#2C2866` | `#3A2DB8` / `#CBC6FF` |
| coral | `#FF5A5F` / `#FF7A7E` | `#FFE2E0` / `#4A2027` | `#B0222C` / `#FFC2C3` |
| cielo | `#1AA3F0` / `#4CC0FF` | `#D9F0FD` / `#14344B` | `#065A8C` / `#B6E3FF` |
| ámbar | `#FFAA00` / `#FFBF3C` | `#FFEFC7` / `#43320F` | `#874600` / `#FFDC94` |
| esmeralda | `#12B886` / `#36D39C` | `#D4F5E7` / `#103D31` | `#05694A` / `#A6F0D3` |
| fucsia | `#E040FB` / `#EC6CFF` | `#F8E0FE` / `#45204F` | `#8E1C9F` / `#F6C3FF` |
| turquesa | `#11C2B3` / `#33DCCB` | `#D1F5F1` / `#0F3D3A` | `#0A675E` / `#A5F1E8` |

### Estados

| Estado | Base | Suave | Tinta | Uso |
|---|---|---|---|---|
| `--exito` | `#16A34A` / `#3AD07A` | `#D8F5E1` / `#123D26` | `#11663A` / `#A6EFC2` | Disponible, pagado, cuadra |
| `--aviso` | `#F59E0B` / `#FFBF3C` | `#FFF1CC` / `#43320F` | `#8A4500` / `#FFDC94` | Existencias bajas, pendiente |
| `--peligro` | `#E5303C` / `#FF6B73` | `#FFE0E1` / `#4A1D22` | `#AB1824` / `#FFC0C3` | Agotado, error, anular |
| `--info` | `#1D8CF8` / `#5AB4FF` | `#DCECFF` / `#14324D` | `#0A5AA8` / `#B9DDFF` | Avisos neutros |

`--peligro-solido` (`#D42A35` / `#FF6B73`) + `--sobre-peligro` para el botón destructivo.

### Contrastes medidos (WCAG 2.x; los exige `tokens.test.ts`)

| Par | Claro | Oscuro | Mínimo exigido |
|---|---|---|---|
| texto / fondo | 14.52 | 15.85 | 7 |
| texto / cualquier superficie (peor caso) | 13.73 | 13.00 | 7 |
| texto-2 / cualquier superficie (peor caso) | 6.05 | 7.11 | 4.5 |
| primario-tinta / cualquier superficie | 7.14 | 7.23 | 4.5 |
| sobre-primario / primario | 6.80 | 6.07 | 4.5 |
| sobre-peligro / peligro-solido | 5.02 | 7.11 | 4.5 |
| tintas categóricas y de estado / su suave | 5.53 – 7.35 | 8.15 – 9.50 | 4.5 |
| tintas / cualquier superficie (peor caso) | 5.36 (esmeralda) | > 7 | 4.5 |
| primario / fondo (objeto gráfico) | 5.75 | 5.85 | 3 |

### Sombras, radios, espacios

- `--sombra-s` (chips, botones), `--sombra` (tarjetas), `--sombra-l` (panel lateral), `--sombra-hundida` (campos, pistas),
  `--sombra-flotante` (hojas, diálogos, botón flotante). Las de dos capas usan `--luz` y `--umbra`, que cambian con el tema.
- Radios: `--radio-s` 10 · `--radio` 16 · `--radio-l` 24 · `--radio-pildora` (botones, chips, buscador).
- Espacios en escala de 4 px: `--esp-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-10` 40 · `-12` 48.

### Tipografía

- **Inter** variable (100–900), latin + latin-ext, cursiva latina; **JetBrains Mono** para código. Locales en
  `src/assets/fonts/`, licencia OFL (`OFL.txt` en cada carpeta), sin CDN. Newsreader y Kalam se quitaron.
- Escala fluida con `clamp()` en `rem`: `--texto-xs` 13–14 · `--texto-s` 14–15 · `--texto-m` **16–17 (cuerpo)** ·
  `--texto-l` 20–24 · `--texto-xl` 26–36 · `--texto-cifra` 28–44. Pesos `--peso-normal` 400 · `--peso-medio` 550 · `--peso-fuerte` 700.
- `.cifras` (o `.dinero`) = `font-variant-numeric: tabular-nums`.

### Alias de Marginalia (no usar en código nuevo)

`--papel` → `--fondo` · `--papel-2` → `--hundido` · `--tinta` → `--texto` · `--tinta-suave` → `--texto-2` ·
`--acento` → `--primario-tinta` · `--acento-suave` → `--primario-suave` · `--letra-cuerpo`/`--letra-mano` → Inter ·
`--radio-grande` → `--radio-l` · `--contorno` → `--borde-fuerte`. `--marca` (resaltador) y `--trazo` siguen.

## Tamaños de pantalla (Material 3 adaptable)

| Clase | Ancho | Navegación | Contenido |
|---|---|---|---|
| Compacto | < 600 px (teléfonos 320–599, plegable cerrado, ventana dividida) | **Barra inferior** de 5 secciones | 1 columna; filtros en **Hoja**; rejilla de productos a 2 columnas desde 320 px |
| Medio | 600–839 px (plegable abierto, tableta vertical pequeña, teléfono horizontal) | **Riel lateral** a la izquierda | Filtros aún en Hoja; rejilla 3–4 columnas |
| Expandido | ≥ 840 px (tabletas, horizontal) | Riel lateral | **Panel de filtros fijo** a la izquierda + contenido; rejilla 4–6 columnas |

Reglas:

- La misma `BarraInferior` se vuelve riel **solo con CSS** (`@media (min-width: 600px)`); sin JS.
- `base.css` fija `--reserva-abajo` (barra + `--margen-abajo`) o `--reserva-lado` (riel + `--margen-izquierda`) cuando
  hay navegación (`:root:has(.barra-inferior)`); `Pagina`, `BotonFlotante` y `.aviso-global` los respetan.
  Mientras se escribe una nota (`.escribiendo`) no se reserva nada.
- Bordes del sistema: `--margen-arriba/-abajo/-izquierda/-derecha` (Capacitor `--safe-area-inset-*` o `env()`).
- `Pagina ancho="lectura"` (68ch, Bitácora) o `ancho="amplio"` (1280 px, negocio). Los márgenes laterales crecen para centrar.
- **Nunca scroll horizontal de página** (`body { overflow-x: clip }`); lo ancho se envuelve o se desplaza dentro de su caja
  (pestañas). Las tablas se apilan por **container query** (< 560 px de contenedor), no por ancho de pantalla.
- Teléfono en horizontal (alto < 480 px): el riel compacta sus elementos.
- Objetivos táctiles: `--toque` = 48 px en botones, chips, casillas (la fila entera), manijas, teclas.
  **Excepción conocida:** el mes de 7 columnas en 320 px deja celdas de ~41 × 48 px (sobre el mínimo WCAG 2.5.8 de 24 px).

## Legibilidad

- Contraste: ver tabla. Texto principal ≥ 7:1, todo texto ≥ 4.5:1, objetos gráficos ≥ 3:1.
- Tamaños: cuerpo ≥ 16 px, nada < 13 px (lo comprueba la prueba de tokens leyendo el mínimo de cada `clamp()`).
- **Letra del sistema al 200 %:** la WebView aplica `textZoom` con la escala de Android. Todo el texto está en `rem`;
  los contenedores crecen en alto (`min-height`, nunca `height` fija para texto) y envuelven (`overflow-wrap`).
  `tests/e2e/pantallas.spec.ts` lo simula doblando el tamaño raíz en 360 px: sin scroll horizontal.
  A ese tamaño las etiquetas de la barra inferior parten en dos líneas (con `hyphens: auto`; en Android salen con guion).
- Foco visible: contorno de 3 px `--foco` en todo lo enfocable por teclado.
- `prefers-reduced-motion`: todas las duraciones pasan a 0.

## Movimiento

Curva `--curva` (enfatizada de Material). `--dur-corta` 180 ms (tocar), `--dur-media` 280 ms (entrar), `--dur-larga`
420 ms (hojas). Animaciones en `base.css`: `entrar`, `aparecer`, `subir`, `fundir`, `temblar` (PIN incorrecto).
Lo tocable se hunde (`scale(0.97)`); los controles elevados pasan a sombra hundida al pulsarlos.

## Componentes (`src/ui/`, cada uno con su CSS)

### Estructura
- **`Pagina`** `{ children, ancho?: 'lectura' | 'amplio' }` — el `<main>`; deja sitio a barra/riel.
- **`Encabezado`** `{ titulo, accion?: {etiqueta, alTocar}, iconos?: {icono, etiqueta, alTocar, activo?}[] }` — único `h1`.
- **`BarraInferior`** `{ actual?: IdSeccion }` — 5 secciones de `SECCIONES` (Inicio, Vender, Inventario, Bitácora, Más); riel desde 600 px.
- **`Disposicion`** `{ panel, tituloPanel? = 'Filtros', activos?, piePanel?, barra?, children }` — panel lateral fijo
  (≥ 840 px) o botón «Filtros (n)» que abre una `Hoja` con el mismo panel y su pie fijo.
- **`Rejilla`** `{ children, tipo?: 'producto' | 'cifra', etiqueta? }` — `repeat(auto-fill, minmax(…))`.
- **`Tarjeta`** `{ children, variante?: 'elevada' | 'hundida' | 'plana' }`.
- **`Hoja`** `{ titulo, alCerrar, children, pie? }` — hoja inferior (diálogo centrado en ≥ 600 × 560), foco atrapado, Escape.
- **`Dialogo`** `{ titulo, children, alConfirmar, alCerrar, etiquetaConfirmar?, etiquetaCancelar?, peligro? }` —
  `alertdialog`, foco inicial en Cancelar, atrapado, vuelve al cerrar.

### Acciones
- **`Boton`** `{ children, variante?: 'contorno' | 'texto' | 'primario' | 'tonal' | 'peligro', alTocar?, desactivado?, icono?, ancho?, tipo?, etiqueta? }`.
- **`BotonFlotante`** `{ etiqueta, icono? = 'mas-signo', alTocar, extendido?, fijo? = true }` — sobre la barra, respeta bordes.
- **`Chip`** `{ children, seleccionado, alCambiar, contador?, color?, desactivado? }` — `aria-pressed`.
- **`ChipFiltro`** `{ children: string, alQuitar }` — filtro activo con ×; nombre «Quitar filtro: …».
- **`GrupoChips`** `{ etiqueta, children }` — fila que envuelve.
- **`Pestanas`** `{ etiqueta, pestanas: {id, etiqueta, contador?}[], actual, alCambiar, children? }` — flechas, Inicio, Fin.
- **`Segmentado`** `{ etiqueta, opciones, valor, alCambiar }` — 2–4 opciones.

### Entradas
- **`CampoTexto`** `{ etiqueta, valor, alCambiar, marcador?, ayuda?, error?, tipo?, ocultarEtiqueta? }`.
- **`CampoNumero`** `{ etiqueta, valor: string, alCambiar(texto), prefijo?, sufijo?, marcador?, ayuda?, error?, desactivado?, alConfirmar?, grande? }` —
  `inputmode="decimal"`; **no convierte**: entrega el texto y el núcleo (`leerDinero`/`leerCantidad`) valida.
- **`Buscador`** `{ etiqueta, valor, alCambiar, marcador?, alBuscar? }` — `role="search"`, lupa y borrar.
- **`Casilla`** `{ etiqueta, marcada, alCambiar, contador?, indeterminada?, desactivada? }` — checkbox nativo, fila tocable.
- **`Rango`** `{ etiqueta, min, max, paso?, valorMin, valorMax, alCambiar(min, max), prefijo?, sufijo?, formatear? }` —
  dos `input[type=range]` (cada manija con nombre) + campos Mín./Máx.
- **`MuestraColor`** `{ etiqueta, opciones: {valor, nombre, color}[], valor, alCambiar }` — radiogroup con flechas.
- **`Interruptor`** / **`Conmutador`** `{ etiqueta, activo, alCambiar, descripcion?, desactivado? }` — `role="switch"`.
- **`TecladoNumerico`** `{ valor, alCambiar, extra? = '000', maximo? = 12, alConfirmar?, etiquetaConfirmar? = 'Cobrar', confirmarDesactivado?, etiqueta? }` — caja.
- **`TecladoPin`** `{ valor, alCambiar, alCompletar(pin), longitud? = 4, etiqueta?, error?, accion?, desactivado? }` —
  3×4 grande, solo puntos (`role="img"` «2 de 4 dígitos»), error anunciado y tiembla, acepta teclado físico.
- **`SelectorFecha`**, **`CeldaDia`** — calendario de la Bitácora.

### Datos
- **`TarjetaProducto`** `{ nombre, precio, existencias?, estado?: 'ok' | 'bajo' | 'agotado', color?, nombreCategoria?, imagen?, icono?, alTocar?, alAgregar?, etiquetaAgregar?, enPedido? }` —
  imagen/icono/inicial en el suave de la categoría; el nombre es un enlace estirado (toda la tarjeta), el + va aparte.
- **`Cifra`** `{ etiqueta, valor, variacion?, tendencia?: 'sube' | 'baja' | 'igual', subirEsBueno? = true, detalle?, icono?, color? }`.
- **`Tabla`** `{ titulo, verTitulo?, columnas: {clave, titulo, celda, numerica?, principal?}[], filas, claveFila, alTocarFila?, vacia? }` —
  tabla real con roles ARIA; en contenedor estrecho, filas apiladas con «Título: valor».
- **`Insignia`** `{ children, tono?: 'neutro' | 'primario' | 'exito' | 'aviso' | 'peligro' | 'info' | Categoria, icono? }`.
- **`Etiqueta`** `{ children, tipo?, color? }` — píldora de solo lectura (Bitácora).
- **`Avatar`** (= `InicialUsuario`) `{ nombre, color?, tamano?: 's' | 'm' | 'l', foto? }` y
  **`BotonUsuario`** `{ nombre, rol?, color?, seleccionado?, alTocar }` — selector de usuario antes del PIN.
- **`EstadoVacio`** `{ mensaje, pista }`.

### Iconos (`Icono` `{ nombre, tamano? }`)
24 × 24, trazo 1.75, puntas redondas, sin relleno, curvas suaves; siempre decorativos (el nombre accesible lo pone quien
los usa). Negocio: `inicio`, `vender`, `inventario`, `mas` (cuadrícula), `caja`, `factura`, `gasto`, `contabilidad`,
`usuarios`, `filtros`, `mas-signo`, `menos`, `cerrar`, `check`, `adjunto`, `camara`, `alerta`, `importar`, `exportar`,
`papelera`, `editar`, `flecha`, `sube`, `baja`, `retroceso`, `buscar`, `candado`. Bitácora: `notas`, `calendario`,
`ajustes`, `atras`, `tarjetas`, `lista`, `izquierda`, `derecha`, `mover`, `musica`.
Para «crear», usa `mas-signo` (`mas` es la sección «Más»).

## Verificación

- `tests/unit/tokens.test.ts` — contrastes, tamaños mínimos, temas idénticos, sin colores sueltos.
- `tests/unit/componentes.test.tsx`, `navegacion.test.tsx`, `fuentes.test.ts` — API y accesibilidad de los componentes.
- `tests/e2e/pantallas.spec.ts` — `#/galeria` en 320×640, 360×800, 412×915, 600×960, 800×1280, 1280×800, texto al 200 % y
  oscuro; capturas en `capturas/diseno/` (ignorada por git).

## Lista de verificación antes de entregar una pantalla
- [ ] ¿Una sola acción principal? ¿Algo sobra?
- [ ] ¿Solo tokens (cero colores sueltos)? ¿Texto de color en su *tinta*, nunca en la base?
- [ ] ¿Se ve en 320 px, en plegable y en tableta horizontal, sin scroll lateral?
- [ ] ¿Se lee con la letra del sistema al 200 %?
- [ ] ¿Todo lo tocable ≥ 48 px y con nombre accesible?
