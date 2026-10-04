# ESTADO — memoria viva del proyecto

> Se importa en cada sesión desde `CLAUDE.md`. Mantenlo **corto** (< 80 líneas): archiva lo viejo en la sección "Historial" con una línea por sesión.
> Lo actualiza `/cierre`. Si algo aquí contradice el código, arréglalo aquí.

## Ahora
- **Fase actual:** F0 — Cimientos
- **Estado:** construida y CI en verde; **falta la verificación en el teléfono** (criterio de aceptación + resultado del spike)
- **Última sesión:** 2026-10-04
- **Siguiente paso concreto:** el autor instala el APK y reporta el spike A/B → anotar resultado aquí, cerrar F0 y pasar a `/fase 1`

## Decisiones tomadas (ADR en `docs/ARQUITECTURA.md`)
- 001 Web + Capacitor + Preact · 002 `.md` fuente de verdad · 003 solo IFrame oficial · 004 MIT (Pablo, 2026) · 005 nombre "Marginalia", appId `io.github.barmanpb74.appnoti`
- 006 TypeScript 6.0 (no 7): `typescript-eslint` 8.71 solo soporta TS < 6.1. Dependabot ignora TS 7 hasta que lo soporte.
- Node 24 LTS (Capacitor 8 pide ≥ 22). En el teléfono vive en `/opt/node24` (no reemplaza el Node 20 del sistema): `export PATH=/opt/node24/bin:$PATH`.
- El APK **solo se compila en GitHub Actions**: el SDK de Android (sdkmanager, aapt2) solo existe para x86_64 y el teléfono es aarch64. Lint, tests unitarios y e2e (Playwright) sí corren en el teléfono.
- Acciones de GitHub fijadas por SHA; token de CI con permisos mínimos.
- Sin `@testing-library` por ahora: Preact `render` + `act` + jsdom bastan.

## Pendiente de decidir con el autor
- (nada)

## Probar en el teléfono (lo que el entorno de Claude no puede verificar)
1. Instalar `Download/marginalia-debug.apk` (o desde Actions → CI → artefacto `marginalia-debug-apk`). Android pedirá permitir "instalar apps desconocidas".
2. Abrir: ¿se ve la pantalla de papel crema con "Marginalia"?
3. Tocar **Probar A (nocookie)** y darle play al video. ¿Suena? ¿Sale "Error 152/153" u otro?
4. Cerrar y repetir con **Probar B (youtube.com)**.
5. Reportar A y B: carga sí/no, reproduce sí/no, texto exacto del error si lo hay.

## Permisos Android autorizados
- `INTERNET` (reproductor). Verificado en el manifiesto compilado del APK de CI.
- Nota: `android.permission.DUMP` aparece en el APK como **protección** del `ProfileInstallReceiver` de AndroidX (solo adb/sistema pueden llamarlo); no es un permiso que la app pida.

## Dependencias justificadas
- `preact` 11 · UI de 4 kB · MIT · `@capacitor/core` + `@capacitor/android` 8.5 · puente y proyecto Android · MIT
- Dev: `vite` 8 (build) MIT · `@preact/preset-vite` MIT · `typescript` 6.0 Apache-2.0 · `eslint` 10 + `@eslint/js` + `typescript-eslint` + `globals` MIT · `vitest` 5 + `jsdom` MIT · `@playwright/test` Apache-2.0 · `@capacitor/cli` MIT
- Auditoría de licencias (2026-10-04): todas compatibles; MPL-2.0 solo en `lightningcss` (herramienta de build, sin modificar).

## Riesgos abiertos
- Embed de YouTube en WebView (errores de origen/Referer) — spike listo en `src/spike/`, falta probarlo en el teléfono. Resolución en F4.
- `npm audit` (dev): 3 moderadas en `@capacitor/cli` → `xcode` → `uuid` (herramienta de iOS, no se usa; producción limpia). Revisar cuando salga un CLI corregido.
- Build *release* sin minificación ni firma todavía (corresponde a F6).

## Banco de ideas (NO construir sin decisión del autor)
- (vacío)

## Historial de sesiones
- 2026-10-04 · F0 · repo público, licencia y docs de seguridad, Vite+Preact+TS+Capacitor endurecido, CI verde con APK debug, CodeQL, gitleaks, dependency-review, Dependabot, push protection; spike del reproductor listo para probar.
