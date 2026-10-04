# FASES — plan ejecutable

Regla: **una fase = algo demostrable**. No se pasa a la siguiente sin cumplir los criterios de aceptación y la Puerta de seguridad (`docs/SEGURIDAD.md` §4). Cada fase puede ocupar varias sesiones; cada sesión hace ≤ 5 pasos y cierra con `/cierre`.

Ciclo dentro de cada fase: **explicar → construir → probar → mejorar**.

---

## F0 — Cimientos
**Objetivo:** repositorio sano, seguro y que compila un APK vacío.
**Entregables:**
- Repo con `LICENSE`, `README.md` mínimo, `SECURITY.md`, `PRIVACIDAD.md` (borrador), `.gitignore` (incluye `docs/referencia/`, keystores, `.env`).
- Proyecto Vite + Preact + TS estricto + Capacitor Android; scripts `dev/build/lint/test/test:e2e/audit`.
- CI en GitHub Actions: lint, test, build, **APK debug como artefacto**, CodeQL, gitleaks, dependency-review; Dependabot.
- Spike corto del reproductor (¿carga el iframe en WebView?): solo anotar el resultado en `ESTADO.md`, sin construir la función.
- Decidir nombre definitivo (ADR-005) y licencia (ADR-004) con el autor.
**Aceptación:** `npm run build` y CI en verde; el APK debug se instala y muestra una pantalla de papel con el nombre.
**Fuera de alcance:** cualquier función de notas.

## F1 — Sistema de diseño y estructura de navegación
**Objetivo:** que la app ya *se sienta* como el dibujo.
**Entregables:**
- `src/ui/tokens.css` (papel, tinta, trazo, radios), textura de papel, fuentes locales (elegir combinación con 3 capturas).
- Componentes base de `docs/DISENO.md` y iconos SVG propios.
- Navegación inferior de 4 secciones (pantallas vacías con estado vacío elegante).
- `Reproductor` y `MiniReproductor` **estáticos** al estilo de la referencia (sin sonido).
- Página interna `/galeria` con todos los componentes (para revisarlos de un vistazo).
**Aceptación:** capturas en Chromium (móvil 390×844) de las 4 secciones y la galería, revisadas por el autor; contraste ≥ 7:1; cero colores fuera de tokens.
**Fuera de alcance:** guardar datos.

## F2 — Notas Markdown locales
**Objetivo:** escribir, guardar y encontrar notas.
**Entregables:**
- Repositorio de notas sobre `Almacen` (archivos `.md`, escritura atómica), IDs ULID, árbol de páginas (padre/hijos).
- Editor CodeMirror 6 con estilo mínimo + modo lectura (render sanitizado); barra de herramientas mínima.
- Lista de notas con búsqueda de texto (índice SQLite/FTS5 o en memoria si el spike lo justifica; reconstruible).
- Exportar/importar ZIP con validaciones.
**Aceptación:** historias 1, 2, 6 (texto) y 7 funcionan; pruebas de XSS y de archivos hostiles pasan; recarga conserva todo.
**Fuera de alcance:** etiquetas de fecha/canción.

## F3 — Etiquetas y Calendario
**Objetivo:** que las notas con fecha aparezcan en un calendario.
**Entregables:**
- Parser completo de `docs/FORMATO_NOTAS.md` (`#etiqueta`, `@fecha`, `fecha:`), con pruebas límite.
- Filtro por etiqueta; autocompletar `#` y `@` en el editor; selector de fecha propio.
- Sección **Calendario**: vista mes (lunes primero, hoy resaltado), notas por día, hoja inferior al tocar un día, navegación de mes con gesto; vista agenda simple.
**Aceptación:** historia 3; una nota con 2 fechas aparece en 2 días; fechas inválidas ignoradas; 500 notas no ralentizan el mes.
**Fuera de alcance:** recordatorios/notificaciones, integración con Google Calendar.

## F4 — Música y etiqueta de canción
**Objetivo:** estudiar con música y recordar qué sonaba.
**Entregables:**
- `Reproductor` real con YouTube IFrame Player (interfaz `Reproductor`), controles propios dibujados, progreso, volumen.
- Añadir canción pegando enlace o por **Share Intent** desde YouTube Music; metadatos por oEmbed con caché; lista de canciones guardadas.
- Etiqueta de canción en notas (frontmatter + enlace `yt:` en línea) con segundo exacto; tocar ♪ reproduce desde ese segundo.
- Mini-reproductor persistente entre secciones.
- Manejo elegante de: sin red, video no incrustable, ID inválido. Plan B si el spike falla (ver `docs/ARQUITECTURA.md`).
**Aceptación:** historias 4 y 5 en un teléfono real (checklist en `ESTADO.md`); cumple `docs/LEGAL.md` §1 sin excepciones.
**Fuera de alcance:** segundo plano forzado, descargas, listas de reproducción propias.

## F5 — Ciberseguridad: endurecimiento y auditoría propia
**Objetivo:** demostrar con evidencia que la app es segura.
**Entregables:**
- Auditoría completa según `docs/SEGURIDAD.md` §5 → `docs/seguridad/AUDITORIA-F5.md`.
- Corrección de todos los hallazgos críticos/altos.
- Bloqueo biométrico opcional; decisión (ADR) sobre cifrado en reposo y, si se aprueba, implementación con primitivas estándar.
- Fuzzing básico del parser e importador; pruebas de regresión por cada hallazgo.
- `docs/seguridad/LICENCIAS.md` con auditoría de licencias.
**Aceptación:** 0 críticos/altos abiertos; checklist MASVS-L1 marcado con evidencia; CI con todas las comprobaciones en verde.
**Nota ética:** solo sobre código y dispositivos propios (ver `docs/SEGURIDAD.md` §1).

## F6 — Pulido y publicación
**Objetivo:** repo público listo para otras personas.
**Entregables:**
- Accesibilidad (TalkBack, tamaño de texto), rendimiento según presupuesto, modo "reducir movimiento".
- README con capturas (datos de ejemplo), instalación del APK, límites conocidos, aviso de no afiliación.
- `release.yml`: APK firmado, SHA-256, SBOM, notas de versión; etiqueta `v1.0.0`.
- Revisión final de `docs/LEGAL.md` §6 y de la Puerta de seguridad completa.
**Aceptación:** una persona ajena instala el APK desde Releases siguiendo solo el README.
**Después de v1:** revisar el "Banco de ideas" con el autor y priorizar.
