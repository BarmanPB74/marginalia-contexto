# Stark — contexto maestro

> Antes «Marginalia». Nombre de la app: **Stark** (ADR-017; «BAR BOX» es otro producto del autor y no se usa aquí). Identificador Android: `io.github.barmanpb74.appnoti` (no cambia: Play lo fija al publicar).
> Este archivo se carga en CADA sesión. Mantenlo corto (< 150 líneas). El detalle vive en `docs/`.

## 1. Qué es

App Android **local-first** de **inventario y ventas** para un café o bar (Colombia, COP), con diseño «soft UI» vívido y adaptable a cualquier pantalla. Funciones:

1. **Inventario**: importar desde Excel/CSV (incluida la tabla HTML con extensión .xls de otros sistemas), registro a mano, conteos, mermas, alertas.
2. **Ventas con caja**: abrir caja → vender (descuenta inventario) → cerrar con cuadre. Formas de pago: efectivo, tarjeta, transferencia, cortesía.
3. **Compras** (facturas de proveedor con foto/PDF que se aplican al inventario), **pagos de facturas**, **gastos** y **contabilidad** interna con CSV.
4. **Usuarios con PIN y roles** (dueño, cajero, bodega) en el mismo teléfono; todo queda firmado en un **diario de eventos encadenado**.
5. **Bitácora**: notas Markdown y calendario (lo que era Marginalia).
6. Sin internet, sin cuentas, sin servidor, sin telemetría. Datos cifrados en el teléfono. **No emite factura electrónica.** Repositorio **público**: nunca datos reales del negocio.

Guía del sistema paso a paso: `docs/NEGOCIO.md`. Publicación: `docs/PLAY_CONSOLE.md`. Agentes del proyecto: `.claude/agents/`.

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
| `docs/NEGOCIO.md` | Toques ventas, caja, inventario, compras, gastos, contabilidad o permisos. |
| `docs/PLAY_CONSOLE.md` | Prepares una versión para Play Store. |
| `docs/ESCRITORIO.md` | Toques la versión de Windows (`escritorio/`, Electron). |
| `docs/PRODUCTO.md` | Dudes qué construir o qué NO construir. |
| `docs/DISENO.md` | Toques cualquier pantalla, color, tipografía o componente. |
| `docs/FORMATO_NOTAS.md` | Toques el parser, las etiquetas, el calendario o la canción. |
| `docs/ARQUITECTURA.md` | Toques estructura, almacenamiento, build o dependencias. |
| `docs/SEGURIDAD.md` | Cierres una fase, añadas una dependencia o un permiso. |
| `docs/LEGAL.md` | Toques fuentes, licencias, facturación, textos públicos o README. |
| `docs/FASES.md` | Planees el trabajo (solo la fase actual). |

@ESTADO.md

## 4. Reglas inquebrantables

1. **Legalidad**: sin música ni servicios de terceros (ADR-015). No presentar nada como factura electrónica DIAN. No usar nombres ni marcas de otros sistemas POS. Detalle en `docs/LEGAL.md`.
2. **Local-first**: los datos nunca salen del dispositivo. Sin analíticas, sin trackers, sin cuentas en la nube. **Sin red**: la app no pide INTERNET.
3. **Permisos Android mínimos**: ninguno propio; solo `USE_BIOMETRIC`/`USE_FINGERPRINT` que añade androidx.biometric. Cualquier permiso nuevo requiere justificarlo en `ESTADO.md` y en `docs/SEGURIDAD.md`.
4. **Nunca** subir secretos, keystores, `.env`, tokens ni la imagen de referencia al repo. Verifica con `gitleaks` antes de cada commit grande.
5. **Cada dependencia nueva** se justifica en una línea (qué hace, licencia, mantenimiento, tamaño) y pasa `npm audit`. Preferir pocas y pequeñas.
6. **Markdown seguro**: todo HTML renderizado pasa por sanitización (DOMPurify). Nunca `innerHTML` con contenido de usuario sin sanitizar.
7. **El archivo `.md` es la fuente de verdad**; los índices son reconstruibles. Nunca atrapar las notas en un formato propietario.
8. **Diseño**: respetar `docs/DISENO.md`. Si algo se ve ruidoso, se quita. No añadir color, sombra ni animación sin necesidad.
9. **Alcance**: no añadir funciones fuera de la fase actual. Las ideas nuevas van a la sección "Banco de ideas" de `ESTADO.md`, no al código.
10. **Dinero y cantidades enteros** (centavos y milésimas, nunca floats). Todo cambio del negocio es un **evento** del diario (`src/core/negocio`); nada se borra, se corrige con otro evento. Las pantallas no calculan totales que se guardan.
11. **Honestidad técnica**: si algo no se puede verificar en el entorno (p. ej. probar en un teléfono real), dilo y deja el paso de verificación manual descrito en `ESTADO.md`.

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
│  │  ├─ inicio/ vender/ caja/ inventario/ compras/ gastos/ adjuntos/
│  │  ├─ contabilidad/ usuarios/ mas/ sesion/ negocio/ registro/
│  │  └─ ajustes/
│  ├─ core/               (negocio: diario, reglas, permisos, PIN, contabilidad, importar; notas; almacén cifrado)
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
