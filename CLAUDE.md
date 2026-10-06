# Marginalia — contexto maestro

> Nombre definitivo (ADR-005). Identificador Android: `io.github.barmanpb74.appnoti`.
> Este archivo se carga en CADA sesión. Mantenlo corto (< 150 líneas). El detalle vive en `docs/`.

## 1. Qué es

App Android **local-first** de notas y estudio, en Markdown, con estética de **papel dibujado a mano**: minimalista, elegante, sin ruido visual.
Funciones centrales:

1. Notas en Markdown organizadas en páginas (estructura tipo Notion, sin copiar su interfaz ni su marca).
2. Reproductor de YouTube Music (vía el reproductor oficial incrustado) y notas **etiquetadas con una canción** (+ segundo exacto).
3. Etiquetas de **fecha** → sección **Calendario** (vista de mes tipo Google Calendar) que muestra las notas de cada día.
4. Todo en el dispositivo. Sin cuentas, sin servidor, sin telemetría. Repositorio **público** en GitHub.

Autor: desarrollador autodidacta, detallista y minimalista. Responde **siempre en español**.

## 2. Protocolo de cada sesión (obligatorio)

1. Lee `@ESTADO.md` (ya importado abajo): fase actual, decisiones, siguiente paso.
2. Confirma la fase actual leyendo SOLO su sección en `docs/FASES.md`.
3. Propón un plan de la sesión de **máximo 5 pasos**. No empieces sin tenerlo claro.
4. Ciclo de trabajo: **explicar → construir → probar → mejorar**. Explica brevemente el porqué de cada decisión técnica (el autor está aprendiendo).
5. Antes de dar la fase por terminada, pasa la **Puerta de seguridad** de esa fase (`docs/SEGURIDAD.md`).
6. Al cerrar: actualiza `ESTADO.md`, corre lint + tests, haz commit pequeño y claro.

Atajos: `/inicio`, `/fase`, `/auditar`, `/cierre` (ver `.claude/commands/`).

## 3. Mapa de documentos (léelos cuando toque, no todos siempre)

| Archivo | Léelo cuando… |
|---|---|
| `ESTADO.md` | Siempre (importado). Memoria viva entre sesiones. |
| `docs/PRODUCTO.md` | Dudes qué construir o qué NO construir. |
| `docs/DISENO.md` | Toques cualquier pantalla, color, tipografía o componente. |
| `docs/FORMATO_NOTAS.md` | Toques el parser, las etiquetas, el calendario o la canción. |
| `docs/ARQUITECTURA.md` | Toques estructura, almacenamiento, build o dependencias. |
| `docs/SEGURIDAD.md` | Cierres una fase, añadas una dependencia o un permiso. |
| `docs/LEGAL.md` | Toques YouTube, fuentes, licencias, textos públicos o README. |
| `docs/FASES.md` | Planees el trabajo (solo la fase actual). |
| `docs/referencia/estilo-dibujo.jpg` | Diseñes UI. Es la **referencia visual** (NO se publica). |

@ESTADO.md

## 4. Reglas inquebrantables

1. **Legalidad**: solo YouTube IFrame Player oficial. Prohibido extraer/descargar audio o video, usar `yt-dlp`, NewPipe Extractor, `ytmusicapi` u otras APIs no oficiales, bloquear anuncios o forzar reproducción en segundo plano. Detalle en `docs/LEGAL.md`.
2. **Local-first**: los datos nunca salen del dispositivo. Sin analíticas, sin trackers, sin cuentas. Única red permitida: el reproductor de YouTube, bajo demanda.
3. **Permisos Android mínimos**: solo `INTERNET`. Cualquier permiso nuevo requiere justificarlo en `ESTADO.md` y en `docs/SEGURIDAD.md`.
4. **Nunca** subir secretos, keystores, `.env`, tokens ni la imagen de referencia al repo. Verifica con `gitleaks` antes de cada commit grande.
5. **Cada dependencia nueva** se justifica en una línea (qué hace, licencia, mantenimiento, tamaño) y pasa `npm audit`. Preferir pocas y pequeñas.
6. **Markdown seguro**: todo HTML renderizado pasa por sanitización (DOMPurify). Nunca `innerHTML` con contenido de usuario sin sanitizar.
7. **El archivo `.md` es la fuente de verdad**; los índices son reconstruibles. Nunca atrapar las notas en un formato propietario.
8. **Diseño**: respetar `docs/DISENO.md`. Si algo se ve ruidoso, se quita. No añadir color, sombra ni animación sin necesidad.
9. **Alcance**: no añadir funciones fuera de la fase actual. Las ideas nuevas van a la sección "Banco de ideas" de `ESTADO.md`, no al código.
10. **Honestidad técnica**: si algo no se puede verificar en el entorno (p. ej. probar en un teléfono real), dilo y deja el paso de verificación manual descrito en `ESTADO.md`.

## 5. Stack (decidido; cambios solo vía ADR en `docs/ARQUITECTURA.md`)

- TypeScript estricto + Vite + Preact
- Capacitor (Android) — empaqueta la app web como APK
- CodeMirror 6 (editor Markdown), `markdown-it` o `marked` + DOMPurify (render)
- Archivos `.md` en almacenamiento privado de la app + índice en memoria reconstruible (ADR-007)
- Vitest (unitarias) + Playwright (e2e sobre la build web)
- GitHub Actions: lint, test, build APK debug, CodeQL, gitleaks, dependency-review
- Verifica las **versiones actuales** en documentación oficial al empezar; no fijes versiones de memoria.

## 6. Estructura objetivo del repositorio

```
/
├─ CLAUDE.md  ESTADO.md  README.md  LICENSE  SECURITY.md  PRIVACIDAD.md
├─ docs/                  (contexto; ver mapa arriba)
├─ .claude/commands/      (atajos de sesión)
├─ .github/workflows/     (ci.yml, codeql.yml, release.yml)
├─ src/
│  ├─ app/                (shell, navegación, rutas)
│  ├─ ui/                 (sistema de diseño: tokens, componentes "dibujados")
│  ├─ features/
│  │  ├─ notas/           (editor, lista, árbol de páginas)
│  │  ├─ calendario/      (vista mes/semana/agenda)
│  │  ├─ musica/          (reproductor, mini-player, etiqueta de canción)
│  │  └─ ajustes/
│  ├─ core/               (parser de notas, índice, almacenamiento, utilidades)
│  └─ assets/fonts/       (fuentes locales, licencia OFL)
├─ tests/                 (unit/ y e2e/)
└─ android/               (generado por Capacitor)
```

## 7. Comandos (se completan en la Fase 0)

```
npm run dev | build | lint | test | test:e2e | audit
npx cap sync android
```

## 8. Convenciones

- Commits: `tipo(ámbito): resumen` (feat, fix, docs, test, chore, sec). Pequeños y atómicos.
- Código y comentarios en español; nombres de identificadores en inglés o español, pero **consistentes**.
- Toda función del parser (`core/`) lleva pruebas unitarias.
- Accesibilidad: objetivos táctiles ≥ 48 dp, contraste tinta/papel ≥ 7:1.
