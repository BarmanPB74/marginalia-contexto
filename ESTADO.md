# ESTADO — memoria viva del proyecto

> Se importa en cada sesión desde `CLAUDE.md`. Mantenlo **corto** (< 80 líneas): archiva lo viejo en la sección "Historial" con una línea por sesión.
> Lo actualiza `/cierre`. Si algo aquí contradice el código, arréglalo aquí.

## Ahora
- **Fase actual:** F1 — Sistema de diseño y navegación
- **Estado:** en curso. Hecho: tokens + textura, fuentes B, componentes base, galería (`#/galeria`), iconos SVG propios, `BarraInferior` + navegación de 4 secciones con estado vacío, icono de la app = marca EK. Falta: Reproductor y MiniReproductor estáticos, capturas finales, `/auditar` de F1.
- **Última sesión:** 2026-10-05
- **Siguiente paso concreto:** `Reproductor` y `MiniReproductor` estáticos (sin sonido) en Música y en la galería; luego `/auditar` y cierre de F1 → push. **Push solo cuando F1 esté completa** (pedido del autor).

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
- El spike del reproductor vive ahora en Música (se borra en F4).

- Mini reproductor (2026-10-05, pedido del autor): anclado sobre la barra por defecto; en Ajustes, "Reproductor flotante" lo vuelve arrastrable por el asa, sin salir de la pantalla ni tapar la barra. En Música no se muestra (ya está el grande). Estado compartido en `src/app/estado.tsx`; en F1 suena una canción de muestra (`demo.ts`), sin sonido.

## Pendiente de decidir con el autor
- (nada)

## Probar en el teléfono (lo que el entorno de Claude no puede verificar)
- Icono del lanzador con la marca EK (círculo/squircle según el lanzador) y que la barra inferior respete la barra de gestos de Android (`safe-area-inset-bottom`).
- Cuando F1 llegue al APK: que las fuentes y la galería (`#/galeria`) se vean como en `/sdcard/Documents/appnoti/capturas-f1/galeria.png`. · Cómo instalar un APK de CI: Actions → CI → artefacto `marginalia-debug-apk`.

## Resultado del spike del reproductor (F0, 2026-10-04, teléfono del autor)
- A `youtube-nocookie.com/embed` dentro de la WebView (origen `https://localhost`): **carga y suena**.
- B `youtube.com/embed`: **carga y suena**.
- Conclusión: el iframe oficial es viable; **no hace falta el Plan B**. F4 usará `youtube-nocookie.com` (privacidad) y borrará `src/spike/`. Falta comprobar en F4 la IFrame API (control por JS, `origin`) y videos de YouTube Music.

## Permisos Android autorizados
- `INTERNET` (reproductor). Verificado en el manifiesto compilado del APK de CI.
- Nota: `android.permission.DUMP` aparece en el APK como **protección** del `ProfileInstallReceiver` de AndroidX (solo adb/sistema pueden llamarlo); no es un permiso que la app pida.

## Dependencias justificadas
- `preact` 11 · UI de 4 kB · MIT · `@capacitor/core` + `@capacitor/android` 8.5 · puente y proyecto Android · MIT
- Fuentes (no son paquetes npm): Newsreader 400/400i/600, Kalam 400, JetBrains Mono 400 · @fontsource 5.3.0, latino · OFL-1.1 con `OFL.txt` en cada carpeta · 120 kB en total
- Dev: `vite` 8 (build) MIT · `@preact/preset-vite` MIT · `typescript` 6.0 Apache-2.0 · `eslint` 10 + `@eslint/js` + `typescript-eslint` + `globals` MIT · `vitest` 5 + `jsdom` MIT · `@playwright/test` Apache-2.0 · `@capacitor/cli` MIT
- Auditoría de licencias (2026-10-04): todas compatibles; MPL-2.0 solo en `lightningcss` (herramienta de build, sin modificar).

## Riesgos abiertos
- IFrame API de YouTube (script externo: exige ajustar la CSP `script-src`) — sin probar aún; se valida al inicio de F4.
- `npm audit` (dev): 3 moderadas en `@capacitor/cli` → `xcode` → `uuid` (herramienta de iOS, no se usa; producción limpia). Revisar cuando salga un CLI corregido.
- Build *release* sin minificación ni firma todavía (corresponde a F6).

## Banco de ideas (NO construir sin decisión del autor)
- (vacío)

## Historial de sesiones
- 2026-10-04 · F0 · repo público, licencia y docs de seguridad, Vite+Preact+TS+Capacitor endurecido, CI verde con APK debug, CodeQL, gitleaks, dependency-review, Dependabot, push protection; spike del reproductor listo para probar.
- 2026-10-04 · F0 cerrada · spike probado en el teléfono: A y B cargan y suenan.
- 2026-10-05 · F1 · icono EK, iconos SVG, barra inferior y 4 secciones vacías; e2e de navegación, atrás y barra.
- 2026-10-05 · F1 · componentes base + galería; e2e: táctil ≥ 48 px, sin scroll horizontal.
- 2026-10-05 · F1 · fuentes B empaquetadas + e2e de carga bajo CSP y sin peticiones externas.
- 2026-10-04 · F1 inicio · tokens.css + textura, base.css solo con tokens, pruebas de contraste y colores sueltos, 3 capturas de fuentes.
