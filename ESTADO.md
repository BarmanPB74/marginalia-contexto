# ESTADO — memoria viva del proyecto

> Se importa en cada sesión desde `CLAUDE.md`. Mantenlo **corto** (< 80 líneas): archiva lo viejo en la sección "Historial" con una línea por sesión.
> Lo actualiza `/cierre`. Si algo aquí contradice el código, arréglalo aquí.

## Ahora
- **Fase actual:** Bar Box 1.0 (ADR-015/016, pedido del autor 2026-10-16): inventario, ventas con caja, compras, gastos, contabilidad, usuarios con PIN; Bitácora (notas + calendario); preparada para Play Console. F5 (seguridad) cerrada en código; falta su prueba en el teléfono.
- **Última sesión:** 2026-10-16 — conversión a Bar Box con agentes (núcleo, importador, diseño, 3 de pantallas); sin música ni INTERNET; release.yml.
- **Siguiente paso concreto:** el autor prueba el APK (lista de abajo, **antes copia ZIP de notas**); crea su llave de subida y los secretos (`docs/PLAY_CONSOLE.md` §1); luego F6: prueba interna en Play.

## Decisiones tomadas (ADR en `docs/ARQUITECTURA.md`)
- 001 Web + Capacitor + Preact · 002 `.md` fuente de verdad de las notas · 004 MIT · 005 appId `io.github.barmanpb74.appnoti` (nombre: Bar Box, 015) · 006 TypeScript 6.0 · 007 índice de notas en memoria · 008/014 cifrado AES-256-GCM con clave envuelta por Android Keystore + bloqueo opcional con huella · 009 preferencias en `localStorage`.
- **015 Bar Box:** núcleo `src/core/negocio` = diario de eventos inmutable por día con cadena SHA-256, estado proyectado, reglas (`ReglaRota`), permisos por rol en UNA tabla (dueño, cajero, bodega; descuentos y anular solo dueño), PIN de 4 dígitos PBKDF2 + limitador, contabilidad + CSV. Dinero en centavos y cantidades en milésimas enteras. Se quitaron YouTube, Spotify, Compartir e INTERNET (003/010/012/013 reemplazadas).
- **016 Diseño:** soft UI vívido (Inter local), barra inferior < 600 px / riel ≥ 600 px, filtros laterales ≥ 840 px u hoja; textZoom = letra del sistema; sin permisos para adaptarse a la pantalla.
- Importar inventario: tabla HTML con extensión .xls (lo que exportan otros POS), CSV y XLSX; vista previa y confirmación; no guarda nombre ni marca del sistema de origen. El archivo real del autor NO va al repo (público).
- Puerta de la app: huella del teléfono (opcional) → negocio abierto → persona + PIN (sesión se cierra tras 10 min fuera).
- Adjuntos (foto/PDF de facturas y gastos) cifrados en `negocio/adjuntos/`, validados por firma, imágenes reducidas a 1600 px; cámara sin permiso (cámara del sistema).
- Sin factura electrónica: comprobante interno (LEGAL §1 bis).
- Pantallas por área registradas en `src/features/registro/{ventas,inventario,gestion}.ts`. Agentes del repo en `.claude/agents/`.
- Node 24 LTS; el APK solo se compila en GitHub Actions. Acciones fijadas por SHA. Sin `@testing-library`. Vitest con `css: true`.
- Publicación: `release.yml` (AAB + APK firmados con la llave de subida desde secretos `BARBOX_KEYSTORE_B64/PASS`, versionCode = 100 + ejecución, R8). Guía: `docs/PLAY_CONSOLE.md`.
- Bitácora: CodeMirror 6 + markdown-it/DOMPurify (22 XSS bloqueados); rutas por hash; almacén atómico con temporal; plantillas; calendario con agenda.

## Pendiente de decidir con el autor
- ¿Subir `minSdk` 24 → 26/29? (H5 de la auditoría, F6) · Icono de Bar Box (hoy sigue la marca EK).
- ¿Cajero con descuentos? (hoy solo el dueño) · Ventas por día en contabilidad (gráfico; falta en el núcleo).
- Pedidos aún sin fase: plantillas con gráficos/cálculos; exportar a PDF/documento legal; backlinks, nota diaria.

## Probar en el teléfono (lo que el entorno de Claude no puede verificar)
- **Arranque sin INTERNET:** la app abre y funciona (Capacitor sirve la interfaz sin red). Si no abre, avisar: volver a poner INTERNET es el plan B.
- **Primer uso:** crear dueño con PIN → importar el inventario (.xls del sistema anterior) → revisar vista previa (133 productos, 15 negativos, 1 repetido) → confirmar.
- **Caja y venta:** abrir caja con base → vender con efectivo y cambio, y pago mixto → el inventario baja → cerrar caja contando → diferencia.
- **Compras:** factura con foto desde la **cámara** y con PDF → aplicar → existencias suben → pago parcial. Descargar el PDF desde la ficha.
- **Usuarios:** crear cajero → cambiar de usuario → el cajero no ve costos, contabilidad ni anular.
- **Pantallas:** girar el teléfono; en tableta o plegable, riel lateral y filtros al lado; letra del sistema al máximo → todo legible.
- **ADR-014:** las notas de antes se leen (migración a v2); bloqueo con huella al volver tras > 1 min.

## Permisos Android autorizados
- Ninguno propio (sin INTERNET desde ADR-015). `USE_BIOMETRIC` + `USE_FINGERPRINT` los añade `androidx.biometric` (normales) para el bloqueo opcional.
- `android.permission.DUMP` aparece como **protección** del `ProfileInstallReceiver` de AndroidX; no es un permiso que la app pida.

## Dependencias justificadas
- `preact` 11 · `@capacitor/core`/`android` 8.5 · `@capacitor/filesystem` 8.1.4 · MIT · sin permisos.
- CodeMirror (`state`, `view`, `commands`, `language`, `autocomplete`) + `@lezer/markdown`/`highlight` · MIT · `markdown-it` 15 (MIT; `entities` BSD-2 → aviso en F6) · `dompurify` 3.4 (Apache-2.0) · `yaml` 2.9 (ISC) · `fflate` 0.8 (MIT, ZIP y XLSX).
- Android: `androidx.biometric` 1.1.0 (Apache-2.0). Núcleo de negocio, importador, PIN, gráficos: **sin dependencias nuevas** (WebCrypto, DOMParser, código propio).
- Fuentes locales OFL: Inter variable (~185 kB) + JetBrains Mono. Dev: vite, vitest, jsdom, playwright, eslint, typescript, @capacitor/cli. Licencias: `docs/seguridad/LICENCIAS.md`.

## Riesgos abiertos
- Quitar INTERNET no se ha probado en un teléfono real.
- El archivo del diario de cada día se reescribe completo en cada venta: medir en el teléfono con un día de mucho movimiento.
- La carga con instantánea no revalida la cadena anterior a ella: «Verificar registro» lo hace (correrlo con cada copia).
- El limitador de intentos de PIN vive en memoria (reiniciar la app lo reinicia).
- Bundle JS grande (CodeMirror + pantallas nuevas): medir arranque en frío en gama media.
- La copia de seguridad ZIP cubre las notas; el diario del negocio se exporta en CSV pero aún no hay copia/restauración completa del negocio → F6.
- `overrides` fuerza `uuid` 11.1.1 bajo `xcode`: quitarlo cuando `@capacitor/cli` lo traiga.
- Build release sin probar en teléfono; R8 con reglas para Capacitor añadidas a mano.

## Banco de ideas (NO construir sin decisión del autor)
- Copia y restauración completa del negocio (diario + adjuntos) en un archivo cifrado con contraseña.
- Recetas (un producto de carta gasta varios ingredientes), como en Bar_box (Python).

## Historial de sesiones
- 2026-10-16 · Bar Box · pivote a inventario/ventas: núcleo con diario encadenado (66 pruebas), importador (76), diseño soft UI adaptable, pantallas de ventas/caja, inventario/compras/gastos/adjuntos, contabilidad/usuarios/Más; sin música ni INTERNET; release AAB; 503 unit + e2e.
- 2026-10-06 · F5 · auditoría (MobSF, apktool, Semgrep, osv, fuzzing); ADR-014 Keystore + bloqueo; PR #3.
- 2026-10-05/06 · F4 · música (YouTube, ventana flotante, Spotify) — retirada en ADR-015.
- 2026-10-04/05 · F0–F3 · repo, CI, diseño, notas Markdown cifradas, parser, calendario, ZIP.
