# SEGURIDAD — diseño seguro y auditoría propia (legal y ética)

Objetivo: cumplir **OWASP MASVS nivel 1** en toda la app y nivel 2 en almacenamiento/criptografía si se activa el cifrado. Guía de pruebas: **OWASP MASTG**. La seguridad no es una fase aislada: cada fase tiene su **Puerta de seguridad**.

## 1. Reglas éticas y legales del trabajo de seguridad
- Solo se prueba **código propio, builds propios y dispositivos propios**. Nunca sistemas, cuentas o servidores de terceros.
- Prohibido atacar, escanear o hacer ingeniería inversa de servicios o sistemas de terceros (incluidos otros sistemas POS).
- Herramientas ofensivas (Frida, apktool, jadx, MobSF) únicamente sobre el APK **debug de este proyecto** en un dispositivo/emulador del autor.
- Los hallazgos se documentan, se corrigen y se registran en `docs/seguridad/AUDITORIA-F5.md`. No se publican exploits.
- Divulgación responsable: `SECURITY.md` explica cómo reportar (GitHub *Private vulnerability reporting*).

## 2. Modelo de amenazas (resumen)

| Activo | Amenaza | Control |
|---|---|---|
| Notas del usuario | Teléfono perdido o prestado, copia de archivos | Almacenamiento privado de la app; **cifrado AES-256-GCM siempre activo** (ADR-008); bloqueo biométrico opcional (F5); `FLAG_SECURE` opcional |
| Notas del usuario | Archivo cifrado alterado o cambiado por otro | GCM autentica el contenido y la ruta (AAD): no se descifra y sale como "dañado", sin tocar las demás |
| Contabilidad (ventas, caja, compras, gastos) | Alterar o borrar movimientos para ocultar faltantes | Diario **append-only** con cadena SHA-256 por evento; la carga se niega a escribir sobre una cadena rota (`DiarioDanado`); «Verificar registro» recorre todo; nada se edita, se anula con motivo y queda a la vista (ADR-015) |
| Contabilidad | Persona sin permiso (cajero) anula ventas, cambia precios o ve costos | Roles con PIN propio y tabla única de permisos en el núcleo (`permisos.ts`), comprobada en cada comando, no solo en la pantalla; cada evento guarda quién lo hizo |
| PIN | Adivinar el PIN de otro | PBKDF2-SHA256 (210 000 iteraciones, sal por usuario), comparación en tiempo constante, espera creciente tras 5 fallos; sesión que se cierra tras 10 min fuera de la app |
| Adjuntos (fotos/PDF de facturas) | Archivo hostil o enorme | Tipo validado por firma de bytes (JPEG/PNG/WebP/PDF), máx. 10 MB, imágenes reducidas a 1600 px; guardados cifrados; vistos como `blob:` (CSP `img-src blob: data:`) |
| Importar inventario | Archivo hostil (HTML con scripts, XLSX bomba, BIFF) | Lectura solo de `textContent` vía DOMParser sin ejecutar, rechazo de DOCTYPE en XML, límites de tamaño/filas/columnas, vista previa y confirmación humana; fuzzing |
| CSV exportado | Inyección de fórmulas al abrir en Excel | Celdas que empiezan por = + - @ se prefijan con `'` |
| Notas del usuario | Copias de seguridad automáticas de Android | `allowBackup=false` por defecto + reglas explícitas; exportación solo manual |
| WebView | XSS por Markdown/HTML malicioso en una nota importada | Sanitizar con DOMPurify (lista blanca), CSP estricta, sin `eval`, sin HTML crudo sin sanitizar |
| WebView | Puente JS expuesto a páginas ajenas | Sin `addJavascriptInterface` propio; sin navegación externa; CSP `frame-src 'none'`, `connect-src 'self'` |
| Importación ZIP/MD | *Zip-slip*, archivos gigantes, YAML hostil | Validar rutas, límites de tamaño/cantidad, parser YAML seguro (sin tipos ejecutables), esquema |
| Cadena de suministro | Dependencia comprometida | Pocas dependencias, `package-lock.json` fijo, `npm audit`, Dependabot, `dependency-review`, revisar permisos de plugins de Capacitor |
| Repositorio público | Secretos filtrados, keystore expuesta | `.gitignore` estricto, `gitleaks`, secretos solo en GitHub Secrets, push protection activado |
| Red | Tráfico en claro / MITM | La app no pide INTERNET (ADR-015); igualmente `cleartextTrafficPermitted=false` |
| Privacidad | Fuga a terceros | Sin red (no hay permiso INTERNET), sin analíticas ni trackers |

## 3. Configuración Android obligatoria
- Permisos: ninguno propio (sin `INTERNET`, ADR-015); `USE_BIOMETRIC` y `USE_FINGERPRINT` (normales, sin diálogo; los declara `androidx.biometric` para el bloqueo opcional, ADR-014).
- `android:allowBackup="false"`, `android:usesCleartextTraffic="false"`, `network_security_config.xml` solo HTTPS.
- `android:exported` explícito en cada componente; el único *intent-filter* de entrada es el lanzador (`MAIN`).
- `WebView`: `allowFileAccess=false`, `allowContentAccess=false`, `setJavaScriptEnabled` solo lo necesario, sin depuración remota en *release*.
- Build *release*: ofuscación/minificación activada, `debuggable=false`.
- CSP en `index.html`, por ejemplo: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'` (la vigente). Ajustar con evidencia, nunca relajar "por si acaso".

## 4. Puerta de seguridad por fase (checklist para `/auditar`)

**Siempre (todas las fases):**
- [ ] `npm audit --omit=dev` sin altas/críticas sin justificar.
- [ ] `gitleaks` limpio. Ningún secreto, keystore o imagen de referencia en el árbol ni en el historial.
- [ ] Ningún permiso nuevo sin justificar en `ESTADO.md`.
- [ ] Ninguna dependencia nueva sin línea de justificación (licencia compatible con MIT).
- [ ] Todo contenido de usuario renderizado pasa por sanitización.
- [ ] Lint y tests en verde; pruebas nuevas para el código nuevo.

**F0:** `.gitignore`, `SECURITY.md`, CI con CodeQL + gitleaks + dependency-review, Dependabot, *push protection* activado, `package-lock.json` versionado.
**F1:** CSP presente en `index.html`; fuentes e iconos locales (cero CDN); sin `innerHTML` con datos externos.
**F2:** pruebas de XSS en Markdown (`<script>`, `onerror=`, `javascript:`, `data:`), YAML hostil, notas de 2 MB; escritura atómica de archivos (escribir a temporal + renombrar) para no corromper notas.
**F3:** parser sin ReDoS (probar con entradas largas/patológicas y tiempo máximo); fechas inválidas ignoradas.
**F4:** *allowlist* de `frame-src`; validación estricta del ID de video; *Share Intent* tratado como entrada no confiable; sin servicios en segundo plano innecesarios.
**F5:** auditoría completa (sección 5) → `docs/seguridad/AUDITORIA-F5.md` (2026-10-06; quedan H6 y H7 por decidir).
**F6:** APK release firmado; checksum SHA-256; SBOM; revisión de `PRIVACIDAD.md`, `SECURITY.md` y licencias de terceros.

## 5. Fase 5 — Auditoría propia (el "ethical hacking" de este proyecto)
Hacer, documentar y corregir. Herramientas y qué buscar:

| Herramienta | Uso (solo sobre este proyecto) |
|---|---|
| MobSF (local, en Docker) | Análisis estático del APK debug/release: manifiesto, permisos, componentes exportados, secretos |
| `jadx` / `apktool` | Revisar qué queda expuesto al decompilar el propio APK |
| Semgrep + CodeQL | Reglas JS/TS, XSS, inyección, uso inseguro de WebView |
| `adb` en dispositivo propio | Verificar que no hay datos en rutas públicas ni en *logcat* |
| Frida (solo build debug propio) | Comprobar que no se puede leer/alterar el contenido de notas con la app bloqueada |
| `osv-scanner` / `npm audit` | Vulnerabilidades conocidas en dependencias |
| Fuzzing casero del parser/importador | Archivos hostiles generados por script |

Entregable: `docs/seguridad/AUDITORIA-F5.md` con tabla *hallazgo → severidad → evidencia → corrección → verificación*. Meta: 0 críticos/altos abiertos.

## 6. Cifrado y bloqueo
- **Hecho (ADR-008, 2026-10-05):** cifrado en reposo con WebCrypto AES-256-GCM (`src/core/almacen/cifrado.ts`), sin criptografía propia. Una nota se cifra en el mismo momento en que se crea; exportar la descifra a un formato legible. Pruebas: ida y vuelta, IV distinto cada vez, archivo alterado / de otra ruta / con otra clave → no se descifra.
- Qué **no** protege: teléfono con root o malware con acceso a la app, la app ya abierta, capturas de pantalla.
- **Hecho (ADR-014, 2026-10-06):** clave de datos envuelta por Android Keystore (`claves/notas.v2`), migración v1 → v2 y borrado de la clave de IndexedDB; bloqueo opcional con huella/PIN (BiometricPrompt) y vista previa oculta en «recientes». Pruebas: `boveda.test.ts`, `candado.test.tsx`.
- Recuperación: la clave depende de este teléfono. Si se pierde (reinstalar, cambiar de teléfono, fallo del Keystore), las notas solo vuelven desde una copia ZIP: hacer copias.
- Exportación cifrada opcional con contraseña (derivación Argon2id/PBKDF2 con parámetros documentados).

## 7. Privacidad
Documentar en `PRIVACIDAD.md`: no hay cuentas, no hay servidor, no hay analíticas; los datos viven en el dispositivo; la app no se conecta a nada (sin permiso INTERNET). Decir qué guarda la app y cómo borrarlo todo.
