# ESTADO — memoria viva del proyecto

> Se importa en cada sesión desde `CLAUDE.md`. Mantenlo **corto** (< 80 líneas): archiva lo viejo en la sección "Historial" con una línea por sesión.
> Lo actualiza `/cierre`. Si algo aquí contradice el código, arréglalo aquí.

## Ahora
- **Fase actual:** F5 — Seguridad (empieza 2026-10-06). F4 cerrada: PR #2 fusionado; Spotify en segundo plano (ADR-013) **probado por el autor en el teléfono**.
- **Última sesión:** 2026-10-06 — Spotify App Remote: plugin nativo, fuente YouTube | Spotify en Música, ♪ con segundo de Spotify, `sp=`, compartir desde Spotify, Client ID en Ajustes, firma estable en CI.
- **Siguiente paso concreto:** PR de Spotify a main; F5: auditoría estática del APK, fuzzing del parser/importador, licencias; decidir con el autor Keystore + bloqueo biométrico.

## Decisiones tomadas (ADR en `docs/ARQUITECTURA.md`)
- 001 Web + Capacitor + Preact · 002 `.md` fuente de verdad · 003 solo IFrame oficial · 004 MIT (Pablo, 2026) · 005 nombre "Marginalia", appId `io.github.barmanpb74.appnoti`
- 006 TypeScript 6.0 (no 7): `typescript-eslint` 8.71 solo soporta TS < 6.1. Dependabot ignora TS 7 hasta que lo soporte.
- Node 24 LTS (Capacitor 8 pide ≥ 22). En el teléfono vive en `/opt/node24` (no reemplaza el Node 20 del sistema): `export PATH=/opt/node24/bin:$PATH`.
- El APK **solo se compila en GitHub Actions**: el SDK de Android (sdkmanager, aapt2) solo existe para x86_64 y el teléfono es aarch64. Lint, tests unitarios y e2e (Playwright) sí corren en el teléfono.
- Acciones de GitHub fijadas por SHA; token de CI con permisos mínimos.
- Sin `@testing-library` por ahora: Preact `render` + `act` + jsdom bastan.
- Vitest con `css: true`: sin eso los `.css` (incluso con `?raw`) llegan vacíos y las pruebas de tokens pasaban en falso.
- Contraste: tinta y acento ≥ 7:1 (AAA); `--tinta-suave` solo para texto secundario, exigido ≥ 4.5:1 (AA). `theme-color` de `index.html` repite `--papel` porque una meta no puede leer variables CSS.
- Fuentes (2026-10-05, elección del autor, combinación B): Newsreader (cuerpo) + Kalam (a mano) + JetBrains Mono (código). Locales en `src/assets/fonts/`, sin CDN.
- Rutas por hash: `#/notas` (por defecto), `#/calendario`, `#/musica`, `#/ajustes`, `#/galeria` (interna, sin enlace). Funcionan igual en la WebView, en `vite preview` y en el navegador, sin configurar servidor; el botón atrás de Android recorre el historial.
- Cada componente de `src/ui/` importa su propio CSS; los estilos globales (`a`, `mark`, `code`, foco visible) viven en `base.css`. Pantallas de sección en `src/features/<sección>/`.
- Icono y arranque (2026-10-05, pedido del autor): marca EK de Eisen-Kern redibujada a mano, tinta sobre papel, sin texto. El arranque (splash, también Android 12+) es la misma marca sobre papel. Fuente `recursos/icono/marca-ek.svg` (el PNG negro original queda en el historial de git); regenerar con `node scripts/icono-android.mjs`. La marca **no** es MIT (README, LEGAL §4).
- ADR-007 (2026-10-05, autor): búsqueda con índice **en memoria**, no SQLite.
- Almacén: `Disco` (crudo) + `Almacen` (atómico). En Android, `Filesystem.rename` borra el destino y luego mueve; por eso, si falta `x.md` y hay `x.md.tmp`, se promueve el temporal. Carpeta `Directory.Data` (privada, sin permisos).
- ULID propio (`src/core/notas/ulid.ts`) en vez del paquete `ulid`. Frontmatter YAML con esquema `core`; las listas se escriben con guiones, como Obsidian.
- Borrar una página sube sus hijas al nivel de la borrada; nunca se borran en cascada.
- Bordes del sistema: Capacitor 8 dibuja bajo la barra de estado y la de gestos e inyecta `--safe-area-inset-*`; los tokens `--margen-arriba/--margen-abajo` los usan (con `env()` de respaldo). "Volver" en una nota sube un nivel (madre o lista).
- Editor: CodeMirror 6 con `@lezer/markdown` + GFM directo (sin `@codemirror/lang-markdown`, que arrastra analizadores de HTML/CSS/JS). Lectura: `markdown-it` con `html: false` + DOMPurify con lista blanca de etiquetas; cada barrera sola frena las 22 cargas de XSS de `tests/unit/render.test.ts`. Enlaces externos con `target=_blank rel=noopener noreferrer`.
- Modo al abrir: recién creada en esta sesión (el repositorio lo recuerda; `creado === editado` fallaba al segundo) o vacía → Editar; si no → Leer. Mientras se escribe (`.escribiendo` en `<html>`) se esconden la barra de secciones y el mini, y aparece la barra de formato sobre el teclado.
- Plantillas estilo Obsidian (`{{titulo}}`, `{{fecha}}`, `{{hora}}`), de serie: en blanco, rápida, bitácora (empieza con `@fecha`), reunión.
- 2026-10-05 (pedidos del autor): ADR-008 cifrado AES-256-GCM al crear/guardar, exportar .md/.txt/.html descifrado a `Documentos/Marginalia`; ADR-009 preferencias y canciones en `localStorage`; ADR-010 reproductor oficial controlado por `postMessage` (sin script externo); ADR-011 paleta blanca tipo Pixel + oscuro + movimiento suave. Notas en **tarjetas tipo recientes** por defecto (lista en Ajustes). Paleta de comandos (lupa o Ctrl+K). Calendario de mes con hoja del día y «Nueva bitácora». Globo de música escondible a un lado (botón, lanzarlo al borde o deslizar).
- Reproductor: ADR-012 — un solo iframe en la raíz (`CapaVideo`), sobre el hueco en Música y ventana flotante fuera si sonaba; el globo dibujado solo aparece sin video flotando.
- F4: `cancion:` + `[♪ m:ss](yt:ID?t=S)`; `#/musica?yt=…&t=…` pone esa canción en ese segundo; Share Intent `ACTION_SEND text/plain` con `CompartidoPlugin.java` (texto no confiable, solo IDs válidos); errores 100/101/150 y sin red con aviso; visor ≥ 200 × 200.
- ADR-013 Spotify: SDK oficial App Remote (controla la app de Spotify, que suena en segundo plano; sin red propia ni permisos nuevos). `.aar` descargado en CI con SHA256 fijo. Firma debug estable con el secreto `MARGINALIA_KEYSTORE_B64` (Spotify exige la SHA-1). Premium + máx. 5 cuentas en modo desarrollo.
- F3: `core/parser/parseNota` (etiquetas con subetiquetas, sin ReDoS); `#/notas?etiqueta=x` filtra; autocompletar con `@codemirror/autocomplete` (`#` etiquetas existentes, `@` hoy/mañana/días); `SelectorFecha` propio en hoja; Calendario Mes | Agenda. Las llamadas al plugin de archivos van en fila (lectura colgada muy rara en e2e).

## Pendiente de decidir con el autor
- ¿Envolver la clave de cifrado con Android Keystore (plugin nativo) y bloqueo biométrico? (F5)
- Pedidos aún sin fase: plantillas con gráficos/cálculos y plantillas propias; exportar a PDF/carta/documento legal; backlinks, nota diaria, grafo.

## Probar en el teléfono (lo que el entorno de Claude no puede verificar)
- **Ventana flotante:** en Música poner una canción, ir a Notas → el video sigue sonando en la ventana, sin cortes; arrastrarla por la barra; ⇥ la esconde y pausa; la pestaña ♪ la trae; × la cierra. Que el teclado no la deje tapada.
- **F4 — historias 4 y 5:** «♪ Nueva nota con esta canción» → la nota guarda canción y segundo (píldora bajo el título); botón ♪ del editor → inserta `[♪ m:ss]`; en lectura, tocar ♪ (o la píldora) → Música suena desde ese segundo.
- **Compartir:** en YouTube Music, Compartir → Marginalia (con la app cerrada y abierta) → se abre Música y suena. Compartir texto que no es de YouTube → aviso. Un video que no se deja incrustar → aviso + «Abrir en YouTube Music». Modo avión → aviso de sin conexión.
- **F3:** autocompletar `#`/`@` con el teclado de Android; «@ Fecha»; filtro por etiqueta; Agenda.

## Permisos Android autorizados
- `INTERNET` (reproductor). Verificado en el manifiesto compilado del APK de CI.
- Nota: `android.permission.DUMP` aparece en el APK como **protección** del `ProfileInstallReceiver` de AndroidX (solo adb/sistema pueden llamarlo); no es un permiso que la app pida.

## Dependencias justificadas
- `preact` 11 · UI de 4 kB · MIT · `@capacitor/core` + `@capacitor/android` 8.5 · puente y proyecto Android · MIT
- CodeMirror: `@codemirror/state` 6.7.6, `view` 6.43.13, `commands` 6.11.1, `language` 6.12.4, `@lezer/markdown` 1.7.2, `@lezer/highlight` 1.2.5 · editor · MIT · `markdown-it` 15.0.2 · lectura · MIT (trae `entities` BSD-2 → atribución en F6; `argparse` PSF-2.0 solo en su CLI, no entra al bundle) · `dompurify` 3.4.16 · sanitizar · MPL-2.0 o Apache-2.0 (usamos Apache-2.0)
- Android: Spotify App Remote SDK 0.8.0 (`.aar`, Apache-2.0, beta oficial, 130 kB, sin permisos; descargado y verificado en CI) + `gson` 2.14.0 (Apache-2.0, lo exige el SDK)
- `@capacitor/filesystem` 8.1.4 · notas en la carpeta privada y exportar a Documentos · MIT · no añade permisos · `yaml` 2.9.1 · frontmatter · ISC · Cifrado, búsqueda, enlaces de música: **sin dependencias nuevas** (WebCrypto, código propio) · `fflate` 0.8.3 · ZIP de copia · MIT · sin dependencias · ~8 kB · `@codemirror/autocomplete` 6.20.3 · autocompletar `#`/`@` · MIT · oficial de CodeMirror, reutiliza state/view
- Fuentes (no son paquetes npm): Newsreader 400/400i/600, Kalam 400, JetBrains Mono 400 · @fontsource 5.3.0, latino · OFL-1.1 con `OFL.txt` en cada carpeta · 120 kB en total
- Dev: `vite` 8 (build) MIT · `@preact/preset-vite` MIT · `typescript` 6.0 Apache-2.0 · `eslint` 10 + `@eslint/js` + `typescript-eslint` + `globals` MIT · `vitest` 5 + `jsdom` MIT · `@playwright/test` Apache-2.0 · `@capacitor/cli` MIT
- Auditoría de licencias (2026-10-04): todas compatibles; MPL-2.0 solo en `lightningcss` (herramienta de build, sin modificar).

## Riesgos abiertos
- Bundle JS 678 kB (≈230 kB gzip) tras CodeMirror + autocompletar + markdown-it. Presupuesto: arranque en frío < 2 s. Si el autor nota lentitud al abrir, cargar editor y lectura con `import()` al abrir una nota.
- Control del reproductor por `postMessage` probado solo en Chromium (sin red): falta el teléfono. Si algún video no permite incrustarse, solo queda «Abrir en YouTube Music».
- e2e con 6 navegadores a la vez: 1 de 116 falló al recargar 0,9 s después de escribir (el guardado aún no había terminado). Mismo límite que matar la app justo al teclear.
- `gitleaks` no está en el entorno de Claude: solo corre en CI (verde en el PR #2). El selector de archivos depende del `WebChromeClient` de Capacitor: probar en el teléfono.
- Exportar a `Documentos` en Android ≤ 10 necesita un permiso que no pedimos (regla 3): mostrar alternativa (compartir) si el autor lo usa ahí.
- `npm audit` (dev): 3 moderadas en `@capacitor/cli` → `xcode` → `uuid` (herramienta de iOS, no se usa; producción limpia). Revisar cuando salga un CLI corregido.
- Build *release* sin minificación ni firma todavía (corresponde a F6).

## Banco de ideas (NO construir sin decisión del autor)
- (vacío)

## Historial de sesiones
- 2026-10-06 · F4+ · PR #2 fusionado; Spotify en segundo plano (ADR-013): plugin nativo, panel en Música, ♪ y rutas `sp=`, compartir, firma estable; 316 unit + 31 e2e.
- 2026-10-05/06 · F4 · ♪ con segundo (historias 4 y 5), Share Intent nativo, errores del reproductor, visor ≥ 200 × 200; ventana flotante con el video (opción B, ADR-012), mismo iframe sin recargar, nada delante (e2e en 25 puntos); 291 unit + 30 e2e.
- 2026-10-05 · F2 cerrada (probada por el autor) + pedidos + F3: rediseño, tarjetas, paleta, calendario, cifrado, YouTube Music, ZIP; parser, filtro por etiqueta, autocompletar, selector de fecha, Agenda; PR #2.
- 2026-10-05 · F2 · Almacen atómico, formato, ULID, repositorio/árbol, plantillas; pantalla de Notas con autoguardado; editor CodeMirror + lectura sanitizada (22 XSS bloqueados); bordes del sistema; APK de avance por `f2-avance`.
- 2026-10-04/05 · F0 y F1 cerradas · repo, CI (APK, CodeQL, gitleaks, dependency-review), spike; tokens, fuentes, componentes, galería, icono EK.
