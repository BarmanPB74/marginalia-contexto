# DISEÑO — papel, tinta y trazo a mano

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

| Token | Valor inicial | Uso |
|---|---|---|
| `--papel` | `#FAF7F0` | Fondo (papel cálido, no blanco puro) |
| `--papel-2` | `#F3EEE2` | Superficie elevada / hover muy sutil |
| `--tinta` | `#1E1C19` | Texto y trazos |
| `--tinta-suave` | `#6B665D` | Texto secundario, tiempos, placeholders |
| `--acento` | `#2D4A6B` | Enlaces, etiqueta de canción (tinta azul) |
| `--marca` | `#F2E3A0` al 60 % | Resaltador: solo "hoy" en calendario y selección |
| `--trazo` | `1.5px` | Grosor de línea estándar |
| `--radio` | `14px 12px 15px 11px / 12px 15px 11px 14px` | Esquinas "a mano" (constante, determinista) |

Máximo **2 colores de acento** en toda la app. Contraste tinta/papel ≥ 7:1 (verificar).

## El papel (fondo)
- Color base `--papel` + **textura de ruido muy sutil** con SVG `feTurbulence` en data-URI, opacidad 3–5 %. Solo CSS/SVG, sin imágenes pesadas.
- Estática: nada de parallax ni animación en el fondo. Debe verse agradable durante horas.
- Opcional: viñeta casi imperceptible en los bordes de la pantalla.

## Tipografía (empaquetada localmente, licencia OFL; sin CDN)
Candidatas — **en la Fase 1 genera 3 capturas con combinaciones y elige una**:
- Cuerpo/lectura: *Source Serif 4* (o *Newsreader*).
- Títulos y etiquetas manuscritas: *Patrick Hand* (o *Kalam*). Solo para títulos, etiquetas y reproductor, nunca para párrafos largos.
- Código: *JetBrains Mono*.

Escala: 13 / 15 / 17 / 22 / 30 px. Interlineado cuerpo 1.6. Ancho de lectura ≤ 68 caracteres.

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

## Movimiento
Casi nulo. Transiciones de 120–160 ms, solo opacidad/desplazamiento corto. Respetar `prefers-reduced-motion`.

## Accesibilidad
Objetivos táctiles ≥ 48 dp. Tamaño de texto escalable. Etiquetas accesibles en todos los iconos. Probar con TalkBack en la Fase 6.

## Lista de verificación antes de entregar una pantalla
- [ ] ¿Hay algo que se pueda quitar sin perder función?
- [ ] ¿Solo usa tokens (cero colores sueltos)?
- [ ] ¿Se ve bien sobre el papel a brillo bajo y alto?
- [ ] ¿Capturas adjuntas en `ESTADO.md` (o descritas) para que el autor las revise?
