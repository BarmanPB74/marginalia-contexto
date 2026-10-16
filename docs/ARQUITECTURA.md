# ARQUITECTURA — decisiones y límites

## Decisión de plataforma (ADR-001)
**App web (TypeScript + Vite + Preact) empaquetada con Capacitor para Android.**

Por qué:
- Editor Markdown (CodeMirror 6), calendario y UI "dibujada" (CSS/SVG) son maduros en web.
- Se puede probar casi todo en un navegador headless (Playwright) dentro del entorno de Claude Code, sin emulador Android.
- El APK se construye en GitHub Actions, no hace falta Android Studio local.

Alternativas descartadas: Kotlin + Compose (mejor nativo, pero más lento de iterar y de verificar en este entorno), Flutter (el iframe de YouTube exige WebView igualmente), PWA pura (sin acceso fiable a archivos ni a *share intents*).

> Si en la Fase 0 algo contradice esta decisión, **no cambies de stack en silencio**: escribe un ADR nuevo en este archivo y avisa al autor.

## Capas

```
UI (Preact, tokens, componentes soft UI de src/ui)
   │
features/  inicio · vender · caja · inventario · compras · gastos · adjuntos ·
           contabilidad · usuarios · mas · sesion · negocio (contexto) · notas · calendario · ajustes
   │
core/      negocio (diario, estado, reglas, permisos, PIN, contabilidad, importar) ·
           notas · parser · markdown · almacén cifrado (Keystore)
   │
Plataforma (Capacitor): Filesystem · plugins propios Boveda (Keystore) y Bloqueo (BiometricPrompt)
```

Reglas de dependencia:
- `core/` **no** importa de `features/` ni de `ui/`. Es TypeScript puro y testeable.
- Todo acceso a plataforma pasa por una interfaz (`Almacen`, `Envoltorio`); en tests y en navegador se usan implementaciones en memoria.
- Las pantallas solo cambian el negocio con los comandos de `Negocio` (servicio.ts): nunca escriben archivos del diario ni calculan totales que se guardan.

## Datos
Ver `docs/FORMATO_NOTAS.md`. Resumen: `.md` = verdad (guardado **cifrado** en el teléfono, ADR-008; se exporta en claro); índice de búsqueda en memoria, reconstruible al abrir (ADR-007); preferencias y canciones guardadas en `localStorage` de la WebView (ADR-009).

Capas del almacenamiento: `Disco` (Capacitor, crudo) → `discoCifrado` (AES-GCM) → `Almacen` (rutas validadas, escritura atómica, cola por archivo) → `RepositorioNotas`.

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
- Búsqueda < 150 ms sobre 2 000 notas.

## Registro de decisiones (ADR)
| # | Decisión | Estado |
|---|---|---|
| 001 | Web + Capacitor + Preact | Aceptada |
| 002 | `.md` como fuente de verdad + índice reconstruible | Aceptada (el índice pasa a memoria, ver 007) |
| 003 | Solo YouTube IFrame Player oficial | Reemplazada por 015 (sin música) |
| 004 | Licencia MIT | Aceptada (confirmada en F0, 2026-10-04) |
| 005 | Nombre "Marginalia"; appId `io.github.barmanpb74.appnoti` | Nombre reemplazado por 015 (Bar Box); appId se mantiene |
| 006 | TypeScript 6.0 hasta que `typescript-eslint` soporte TS 7 | Aceptada (2026-10-04) |
| 007 | Índice de búsqueda en memoria (no SQLite/FTS5): 2 000 notas caben de sobra y evita un plugin nativo. Se reconstruye leyendo `notas/`. Revisar si la búsqueda supera 150 ms | Aceptada (2026-10-05, autor) |
| 008 | **Cifrado en reposo de las notas** (pedido del autor, adelanta parte de F5): AES-256-GCM de WebCrypto, IV aleatorio por escritura, ruta del archivo como AAD; clave no extraíble generada en el teléfono y guardada en IndexedDB de la WebView. Cada `.md` lleva la cabecera `MARGINALIA-CIFRADO v1`. Las notas en claro se cifran al arrancar. **Exportar** (Markdown/texto/HTML) produce el archivo descifrado: así ADR-002 sigue en pie (las notas nunca quedan atrapadas). Límites: no protege un teléfono con root ni la app desbloqueada; si se borran los datos de la WebView sin los archivos (Android no lo hace por separado) las notas no se podrían leer; mejora futura: clave envuelta por Android Keystore | Aceptada (2026-10-05, autor) |
| 009 | Preferencias (tema, vista de notas, reproductor) y canciones guardadas (solo ID + título + artista) en `localStorage`: son pocas, de este teléfono y no son notas | Aceptada (2026-10-05) |
| 010 | Reproductor: el iframe oficial (`youtube-nocookie`, `enablejsapi=1`) se controla por `postMessage` con el mismo protocolo que la IFrame API, **sin** cargar su script externo (la CSP sigue con `script-src 'self'`). Solo se aceptan mensajes del origen del reproductor y de su ventana. Sustituye a la interfaz `Reproductor` prevista | Reemplazada por 015 (2026-10-16) |
| 012 | **Reproductor flotante (opción B del autor, F4):** un solo iframe oficial en la raíz de la app (`CapaVideo`). En Música se coloca sobre el hueco del reproductor dibujado; al salir de Música sonando, el mismo iframe (sin recargar) queda como ventana flotante de 264 × 200 + barra para moverla, siempre por encima de todo (z-index 100) para que nada lo tape. Esconderla a un lado la pausa; cerrarla la quita. Salir de Música en pausa no la abre. e2e comprueba ≥ 200 × 200 y que en 25 puntos lo de encima es el propio video | Reemplazada por 015 (2026-10-16) |
| 013 | **Spotify en segundo plano (pedido del autor, F4):** segunda fuente de música con el SDK oficial **Spotify App Remote** 0.8.0 (Apache-2.0, `.aar` de github.com/spotify/android-sdk que CI descarga y verifica por SHA256 con `scripts/spotify-sdk.sh`; no se guarda en el repo) + Gson. Marginalia **no reproduce ni descarga audio**: manda órdenes a la app oficial de Spotify del teléfono por IPC local (sin red propia ni permisos nuevos), que suena en su app y por eso sigue en segundo plano. Plugin `SpotifyPlugin.java` (valida Client ID y URIs) + `useSpotify` (estado validado, segundo interpolado). La autorización la hace la app de Spotify: sin contraseñas ni tokens guardados. El Client ID es público y va en Ajustes. Requisitos de Spotify: app registrada en su Dashboard con el paquete, la SHA-1 de la firma y la redirección `marginalia://spotify`; Premium; modo desarrollo hasta 5 personas. Para una SHA-1 fija, CI firma con el secreto opcional `MARGINALIA_KEYSTORE_B64` (+ `MARGINALIA_KEYSTORE_PASS`) e imprime la huella. YouTube sigue igual (ADR-003/012) | Reemplazada por 015 (2026-10-16) |
| 014 | **Clave en Android Keystore + bloqueo opcional (F5, H6/H7, elección del autor):** la clave de datos AES-256 se guarda envuelta (AES-GCM) por una clave del Keystore (StrongBox si existe, si no TEE) que nunca sale del hardware: `BovedaPlugin.java` + `core/almacen/boveda.ts`, archivo `claves/notas.v2` junto a las notas. Cabecera `MARGINALIA-CIFRADO v2`. Migración v1 → v2 nota a nota (atómica; v1 y v2 se leen a la vez) y la clave v1 de IndexedDB se borra solo cuando no queda ninguna v1. Nunca se crea una clave nueva si hay notas v2 sin la suya. Si el Keystore falla, sigue con v1. Bloqueo: `BloqueoPlugin.java` con BiometricPrompt (huella/rostro débil o PIN/patrón del teléfono), al abrir y al volver tras 1 min fuera; activar/quitar pide confirmar; oculta la vista previa en «recientes» (Android 13+). Con la app bloqueada no se monta nada de las notas. Límites: el bloqueo es de la interfaz (la clave no exige huella para no perder notas si se quita el bloqueo del teléfono); un teléfono con root y la app abierta siguen fuera del alcance | Aceptada (2026-10-06, autor) |
| 015 | **Bar Box (pedido del autor, 2026-10-16):** la app pasa a ser de inventario y ventas para un café/bar; notas y calendario quedan como Bitácora; se quitan YouTube, Spotify y Compartir (y el permiso INTERNET: la app no usa la red). Núcleo puro `src/core/negocio`: **diario de eventos inmutable** por día (`negocio/diario/AAAA-MM-DD.json`, cifrado por el almacén) con **cadena SHA-256**; estado = proyección pura de eventos; reglas en `validar` (`ReglaRota`); permisos en una tabla por rol (dueño, cajero, bodega); PIN de 4 dígitos con PBKDF2 y limitador; instantánea al cerrar caja; contabilidad y CSV. Dinero en centavos y cantidades en milésimas enteras (reglas de Bar_box en Python). Importador `core/negocio/importar` (tabla HTML «.xls», CSV, XLSX) sin rastro del sistema de origen. Adjuntos de facturas/gastos cifrados en `negocio/adjuntos/`. Pantallas por área con registro (`features/registro`). Publicación con `release.yml` (AAB firmado por secretos, R8) | Aceptada (2026-10-16, autor) |
| 016 | **Diseño Bar Box y pantallas adaptables:** soft UI claro/oscuro con paleta categórica vívida (contrastes medidos en pruebas), Inter local; barra inferior < 600 px y riel lateral ≥ 600 px; panel de filtros lateral ≥ 840 px u hoja en compacto; `resizeableActivity`, `supports-screens`, `adjustResize` y `textZoom` = escala de letra del sistema (85–200 %). No hace falta ningún permiso para adaptarse a la pantalla | Aceptada (2026-10-16, autor) |
| 011 | (Reemplazada por 016) Diseño: paleta clara de neutros fríos estilo Android (Pixel) y tema oscuro (sigue al sistema o se fija en Ajustes); se quita la textura de papel viejo; se mantiene el trazo a mano. Movimiento suave con curvas de Material, siempre con `prefers-reduced-motion` | Aceptada (2026-10-05, autor) |
