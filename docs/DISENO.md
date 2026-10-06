# DISEÑO — blanco limpio, tinta y trazo a mano

> **2026-10-05, pedido del autor (ADR-011):** fuera el amarillo de papel viejo. Fondo blanco frío y
> neutros como los del sistema de Android (Pixel), tema oscuro que sigue al teléfono, y movimiento suave.
> El dibujo a mano se queda: trazos, esquinas irregulares, letra Kalam en títulos e iconos propios.
> Donde este documento diga "papel", léase "fondo" (`--papel` sigue siendo el nombre del token).

Referencia visual: `docs/referencia/estilo-dibujo.jpg` (mira la imagen antes de diseñar cualquier pantalla).
**La imagen es solo inspiración. NO se copia su contenido** (ni el texto de canción/artista, ni el icono de AirPlay, ni ningún elemento de Apple o Notion) y **NO se publica en el repo** (`docs/referencia/` va en `.gitignore`).

## Qué extraemos de la imagen
- Línea negra fina sobre blanco; sin rellenos, sin sombras, sin degradados.
- Contenedores como rectángulos de **esquinas redondeadas y trazo ligeramente irregular** (hecho a mano).
- Tipografía manuscrita, pequeña y limpia para etiquetas.
- Reproductor: portada cuadrada vacía, título + artista, **línea de progreso con un punto**, tiempos en los extremos, tres controles (atrás / pausa / adelante), línea de volumen con un punto.
- Mucho aire. Cada elemento tiene una razón de estar.

## Principio rector
> Si dudas entre añadir y quitar, quita. Elegante = silencioso.

## Tokens (CSS variables; única fuente de verdad en `src/ui/tokens.css`)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--papel` | `#FCFCFF` | `#111318` | Fondo |
| `--papel-2` | `#F0F2F7` | `#1D2026` | Barra inferior, campos, toque |
| `--superficie` | `#FFFFFF` | `#191C21` | Tarjetas, hojas, reproductor (con `--sombra` suave) |
| `--tinta` | `#1B1C20` | `#E4E6EC` | Texto y trazos |
| `--tinta-suave` | `#5B5F68` | `#A3A8B3` | Texto secundario |
| `--acento` | `#0B4CB4` | `#A8C7FA` | Enlaces, @fechas, elegido |
| `--acento-suave` | `#D8E4FB` | `#233A5E` | Píldora de la barra, opción elegida, etiquetas |
| `--marca` | azul 45 % | azul 22 % | Resaltador: "hoy" y selección |
| `--contorno` | tinta 78 % | tinta 78 % | Trazo de tarjetas y controles |

Contraste verificado por `tests/unit/tokens.test.ts` en **los dos temas**. El tema oscuro vive dos veces en `tokens.css` (media query del sistema y `[data-tema='oscuro']`); la prueba exige que sean idénticos.
| `--trazo` | `1.5px` | Grosor de línea estándar |
| `--radio` | `14px 12px 15px 11px / 12px 15px 11px 14px` | Esquinas "a mano" (constante, determinista) |

Máximo **2 colores de acento** en toda la app. Contraste tinta/papel ≥ 7:1 (verificar).

## El fondo
- Liso, `--papel`, sin textura (ADR-011). Estático: nada de parallax ni animación en el fondo.
- La profundidad la dan las superficies (`--superficie` + `--sombra`), no el fondo.

## Tipografía (empaquetada localmente, licencia OFL; sin CDN)
Candidatas — **en la Fase 1 genera 3 capturas con combinaciones y elige una**:
- Cuerpo/lectura: *Source Serif 4* (o *Newsreader*).
- Títulos y etiquetas manuscritas: *Patrick Hand* (o *Kalam*). Solo para títulos, etiquetas y reproductor, nunca para párrafos largos.
- Código: *JetBrains Mono*.

Escala: 13 / 15 / 17 / 22 / 30 px. Interlineado cuerpo 1.6. Ancho de lectura ≤ 68 caracteres.
Márgenes laterales `--margen-lado` = `clamp(16px, 5vw, 24px)`: se ve bien de 320 px a tabletas.

## Trazo "a mano" sin coste de rendimiento
- Bordes con `border-radius` asimétrico fijo (token `--radio`). **No** aplicar filtros SVG de desplazamiento sobre listas largas (lentos en WebView).
- Iconos: SVG propios, `stroke-width: 1.75`, `stroke-linecap: round`, `fill: none`. Diseñarlos nosotros: nada de librerías de iconos genéricas ni iconos de Apple.
- Separadores: línea de 1px `--tinta` a 15 % de opacidad.

## Componentes base (Fase 1)
`Pagina` (lienzo de papel), `Tarjeta` (contorno dibujado), `Boton` (contorno / solo texto), `Etiqueta` (píldora de trazo), `CampoTexto`, `Interruptor`, `BarraInferior` (4 iconos + etiqueta manuscrita), `Encabezado` (título manuscrito + 1 acción), `Reproductor` y `MiniReproductor`, `CeldaDia` (calendario).

## Pantallas clave
1. **Notas**: lista con títulos manuscritos, sangría para sub-páginas, sin iconos decorativos.
2. **Editor**: lienzo casi vacío; barra de herramientas mínima que aparece sobre el teclado (negrita, lista, tarea, enlace, ♪ canción, @ fecha). Modo lectura/escritura con un solo toque.
3. **Calendario**: cuadrícula de mes con trazo fino, semana inicia en lunes, hoy resaltado con `--marca`, puntos o líneas cortas por nota; tocar el día abre una hoja inferior con sus notas.
4. **Música**: reproductor grande al estilo de la referencia (portada cuadrada, título, progreso con punto, 3 controles) + lista de canciones guardadas.
5. **Ajustes**: lista plana, sin tarjetas.

## Movimiento (ADR-011: suave y abundante, nunca ruidoso)
- Curva `--curva` (enfatizada de Material). Duraciones: `--dur-corta` 180 ms (tocar), `--dur-media` 320 ms (entrar, cambiar), `--dur-larga` 460 ms (hojas, tarjetas).
- Animaciones compartidas en `base.css`: `entrar` (fundido + 10 px hacia arriba), `aparecer` (fundido + escala 0.96), `subir` (hojas), `fundir` (velos).
- Las de entrada usan relleno `backwards`: al terminar no dejan `transform` (que crearía un contexto de apilamiento y taparía hojas fijas).
- Todo lo tocable se hunde un poco (`scale(0.97)`); la píldora de la barra se ensancha; el mes del calendario se desliza en la dirección del gesto; las tarjetas recientes escalan con el desplazamiento (`animation-timeline: view()` cuando existe).
- `prefers-reduced-motion`: todas las duraciones pasan a 0.

## Accesibilidad
Objetivos táctiles ≥ 48 dp. Tamaño de texto escalable. Etiquetas accesibles en todos los iconos. Probar con TalkBack en la Fase 6.

## Lista de verificación antes de entregar una pantalla
- [ ] ¿Hay algo que se pueda quitar sin perder función?
- [ ] ¿Solo usa tokens (cero colores sueltos)?
- [ ] ¿Se ve bien sobre el papel a brillo bajo y alto?
- [ ] ¿Capturas adjuntas en `ESTADO.md` (o descritas) para que el autor las revise?
