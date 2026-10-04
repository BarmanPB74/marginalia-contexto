# ARQUITECTURA — decisiones y límites

## Decisión de plataforma (ADR-001)
**App web (TypeScript + Vite + Preact) empaquetada con Capacitor para Android.**

Por qué:
- El reproductor oficial de YouTube es un `iframe`; en una WebView funciona de forma nativa.
- Editor Markdown (CodeMirror 6), calendario y UI "dibujada" (CSS/SVG) son maduros en web.
- Se puede probar casi todo en un navegador headless (Playwright) dentro del entorno de Claude Code, sin emulador Android.
- El APK se construye en GitHub Actions, no hace falta Android Studio local.

Alternativas descartadas: Kotlin + Compose (mejor nativo, pero más lento de iterar y de verificar en este entorno), Flutter (el iframe de YouTube exige WebView igualmente), PWA pura (sin acceso fiable a archivos ni a *share intents*).

> Si en la Fase 0 algo contradice esta decisión, **no cambies de stack en silencio**: escribe un ADR nuevo en este archivo y avisa al autor.

## Capas

```
UI (Preact, tokens, componentes dibujados)
   │
features/  notas · calendario · musica · ajustes     ← lógica de pantalla
   │
core/      parser · índice · repositorio de notas · reproductor (puerto)
   │
Plataforma (Capacitor): Filesystem · SQLite · Share Intent · App Lock
```

Reglas de dependencia:
- `core/` **no** importa de `features/` ni de `ui/`. Es TypeScript puro y testeable.
- Todo acceso a plataforma pasa por una interfaz (`Almacen`, `Reproductor`); en tests y en navegador se usan implementaciones en memoria.
- Un `Reproductor` es una interfaz (`cargar(id, t)`, `reproducir()`, `pausar()`, `tiempoActual()`, eventos). La implementación YouTube vive en `features/musica/yt-iframe.ts`. Así el resto de la app no depende de YouTube.

## Datos
Ver `docs/FORMATO_NOTAS.md`. Resumen: `.md` = verdad; SQLite (FTS5) = índice reconstruible; ajustes en un JSON pequeño.

## Reproductor de YouTube — riesgos conocidos (verificar con un *spike* al inicio de la Fase 4)
1. **Origen/Referer**: YouTube puede rechazar embeds sin un `Referer`/origen válido (errores tipo 150/153). En Capacitor el origen es `https://localhost`. Si falla, probar `server.hostname` propio de Capacitor y la opción `origin`/`widget_referrer` del IFrame API. Documentar qué funcionó.
2. **Segundo plano**: el reproductor incrustado se pausa al apagar la pantalla o salir de la app. **Es un límite aceptado**; no se evade (ver `docs/LEGAL.md`).
3. **Videos no incrustables**: algunos videos desactivan el embed. Mostrar mensaje claro y ofrecer "Abrir en YouTube Music" (Intent oficial).
4. **Plan B legal** si el embed no es viable en WebView: la app abre YouTube Music por Intent, la canción se registra al **compartir** el enlace hacia la app (Share Intent) y el segundo se introduce manualmente. Las notas con canción siguen funcionando.
5. Metadatos (título, artista, miniatura): oEmbed público de YouTube (`https://www.youtube.com/oembed?url=…&format=json`), con caché local. Fallar con elegancia si no hay red.

## Build y CI (`.github/workflows/`)
- `ci.yml`: instalar, `lint`, `test`, build web, build **APK debug** (artefacto descargable).
- `codeql.yml`: análisis estático de JavaScript/TypeScript.
- `secrets.yml` (o paso en `ci.yml`): `gitleaks`.
- `dependency-review` en PRs + Dependabot semanal.
- `release.yml` (Fase 6): al crear una etiqueta `vX.Y.Z`, construir APK **release firmado**. La keystore vive solo en GitHub Secrets; nunca en el repo. Adjuntar checksum SHA-256 y SBOM.

## Verificación en el entorno de Claude Code
- Probado automáticamente: parser, índice, UI en Chromium headless (Playwright), build del APK en CI.
- **No verificable aquí**: comportamiento en un teléfono real (WebView, teclado, Share Intent, biometría). Cada fase deja en `ESTADO.md` una lista corta "Probar en el teléfono" para el autor.

## Rendimiento (presupuesto)
- APK < 15 MB. Arranque en frío < 2 s en un gama media.
- Lista de 2 000 notas fluida (virtualizar listas largas).
- Búsqueda FTS < 150 ms sobre 2 000 notas.

## Registro de decisiones (ADR)
| # | Decisión | Estado |
|---|---|---|
| 001 | Web + Capacitor + Preact | Aceptada |
| 002 | `.md` como fuente de verdad + índice SQLite reconstruible | Aceptada |
| 003 | Solo YouTube IFrame Player oficial | Aceptada (ver LEGAL) |
| 004 | Licencia MIT | Aceptada (confirmada en F0, 2026-10-04) |
| 005 | Nombre "Marginalia"; appId `io.github.barmanpb74.appnoti` | Aceptada (2026-10-04) |
| 006 | TypeScript 6.0 hasta que `typescript-eslint` soporte TS 7 | Aceptada (2026-10-04) |
