# FORMATO_NOTAS — contrato del archivo `.md`

El archivo Markdown es la **fuente de verdad**. Debe abrirse correctamente en cualquier editor (Obsidian, VS Code, Typora…). Toda la sintaxis propia es Markdown estándar o texto plano que se degrada con elegancia.

## Estructura de una nota

```markdown
---
id: 01J9ZK3Q8V2M4N6P7R8S9T0WXY      # ULID, inmutable
titulo: Subjuntivo en francés
creado: 2026-10-03T20:45:00-05:00
editado: 2026-10-03T21:10:00-05:00
etiquetas: [francés, estudio]
fecha: 2026-10-10                    # opcional; entra al calendario
cancion:                             # opcional; "etiqueta de canción" principal
  yt: dQw4w9WgXcQ                    # ID de video de YouTube
  titulo: Título de la canción
  artista: Nombre del artista
  t: 139                             # segundo exacto (1:39) al crear la nota
padre: 01J9ZK0000000000000000ABCD    # opcional; página madre (árbol)
---

# Subjuntivo en francés

Texto normal en **Markdown** (CommonMark + GFM: tablas, tareas, tachado).

- [ ] Repasar conjugaciones
- [x] Ver video

Entrega del ejercicio @2026-10-12 18:30
Estaba sonando [♪ 1:39](yt:dQw4w9WgXcQ?t=139) cuando entendí la regla. #idiomas

Enlace a otra página: [[Pasado compuesto]]
```

## Sintaxis propia (todas opcionales)

| Elemento | Sintaxis | Efecto |
|---|---|---|
| Etiqueta de tema | `#etiqueta` o `etiquetas:` en frontmatter | Filtros y búsqueda |
| Fecha en calendario | `fecha:` en frontmatter **o** `@AAAA-MM-DD` / `@AAAA-MM-DD HH:mm` en el texto | La nota aparece en ese día. Una nota puede tener varias fechas. |
| Canción principal | `cancion:` en frontmatter | Insignia ♪ en la lista; botón de reproducir desde `t` |
| Canción en línea | `[♪ m:ss](yt:VIDEOID?t=SEGUNDOS)` | Enlace estándar con esquema `yt:`; la app lo convierte en botón |
| Enlace entre páginas | `[[Título de página]]` | Navegación; se resuelve por título (insensible a mayúsculas) |
| Callout | `> [!nota] texto` (también `[!ojo]`, `[!tarea]`) | Cita con trazo; se degrada a blockquote |

## Reglas del parser (`src/core/parser/parser.ts`, `parseNota`)
1. No interpretar `#`, `@` ni `[[ ]]` dentro de bloques de código ni de código en línea.
2. `#etiqueta`: solo si va precedido de inicio de línea, espacio o `(` y seguido de letra/dígito (los encabezados `# Título` NO son etiquetas). Permitir letras con tilde y `ñ`, `_`, `-` y `/` (subetiquetas: `#proyectos/marginalia`). Solo números (`#1`, `#2026`) no cuenta. Máximo 64 caracteres. `#Estudio` y `#estudio` son la misma (se comparan en minúsculas). En lectura enlaza a `#/notas?etiqueta=…`.
3. Fechas: validar calendario real (`@2026-02-30` es inválida y se ignora). Zona horaria: la del dispositivo; guardar ISO 8601 con offset en el frontmatter.
4. `yt:` solo acepta IDs que cumplan `^[A-Za-z0-9_-]{11}$`. Todo lo demás se trata como texto.
5. Frontmatter: YAML con esquema validado; campos desconocidos se **preservan** al guardar (no perder datos de otros editores).
6. El parser es una función pura: `parseNota(texto) → { meta, fechas[], etiquetas[], canciones[], enlaces[] }`. Probada con casos límite (vacío, solo frontmatter, Unicode, bloques de código, fechas inválidas, archivos de 1 MB).
7. Tamaño máximo de nota: 2 MB (rechazar o truncar con aviso al importar).

## Captura de la canción (flujo, implementado en F4)
- En Música: «♪ Nueva nota con esta canción» → nota rápida con `cancion:` (yt, título, artista, `t` = segundo actual) y `[♪ m:ss](yt:ID?t=S)` en la primera línea.
- En el editor: botón ♪ de la barra (o la paleta) → inserta el enlace de la última canción elegida en el segundo en que iba.
- En lectura, el enlace ♪ va a `#/musica?yt=ID&t=S` (Música lo carga en ese segundo y limpia la ruta). La píldora bajo el título hace lo mismo con la canción principal.

### Flujo original
1. Hay una canción activa en el reproductor (ID, título, artista, `getCurrentTime()`).
2. El usuario pulsa **♪** en el editor o "Nueva nota con esta canción" en el reproductor.
3. Se crea/actualiza `cancion:` con el segundo actual (entero). Opcionalmente inserta el enlace en línea en la posición del cursor.

## Almacenamiento
- Carpeta privada de la app: `notas/` (un `.md` por página; nombre = `id.md`; el título vive en el frontmatter).
- **En el teléfono cada archivo va cifrado** (ADR-008): cabecera `MARGINALIA-CIFRADO v1` + Base64 de IV ‖ AES-GCM. Dentro, exactamente este formato. Exportar (Markdown/texto/HTML) lo saca a `Documentos/Marginalia/` ya legible; el `.md` exportado se puede volver a leer tal cual.
- Bitácora desde el Calendario: `fecha: AAAA-MM-DD` en el frontmatter y la primera línea del cuerpo es `@AAAA-MM-DD` (enlace al día). En modo lectura, toda `@fecha` válida es un enlace a `#/calendario/AAAA-MM-DD`.
- Índice de búsqueda **en memoria** (ADR-007): notas, etiquetas, fechas, canciones y texto. Se reconstruye escaneando `notas/` al abrir. Nunca es fuente de verdad.
- Exportación/importación: ZIP de la carpeta `notas/` + `LEEME.txt`. Importar valida rutas (anti *zip-slip*), tamaños y esquema.
