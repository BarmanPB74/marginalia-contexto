# SEGURIDAD — diseño seguro y auditoría propia (legal y ética)

Objetivo: cumplir **OWASP MASVS nivel 1** en toda la app y nivel 2 en almacenamiento/criptografía si se activa el cifrado. Guía de pruebas: **OWASP MASTG**. La seguridad no es una fase aislada: cada fase tiene su **Puerta de seguridad**.

## 1. Reglas éticas y legales del trabajo de seguridad
- Solo se prueba **código propio, builds propios y dispositivos propios**. Nunca sistemas, cuentas o servidores de terceros.
- Prohibido atacar, escanear o hacer ingeniería inversa de YouTube/Google u otros servicios.
- Herramientas ofensivas (Frida, apktool, jadx, MobSF) únicamente sobre el APK **debug de este proyecto** en un dispositivo/emulador del autor.
- Los hallazgos se documentan, se corrigen y se registran en `docs/seguridad/AUDITORIA-F5.md`. No se publican exploits.
- Divulgación responsable: `SECURITY.md` explica cómo reportar (GitHub *Private vulnerability reporting*).

## 2. Modelo de amenazas (resumen)

| Activo | Amenaza | Control |
|---|---|---|
| Notas del usuario | Teléfono perdido o prestado, copia de archivos | Almacenamiento privado de la app; **cifrado AES-256-GCM siempre activo** (ADR-008); bloqueo biométrico opcional (F5); `FLAG_SECURE` opcional |
| Notas del usuario | Archivo cifrado alterado o cambiado por otro | GCM autentica el contenido y la ruta (AAD): no se descifra y sale como "dañado", sin tocar las demás |
| Notas del usuario | Copias de seguridad automáticas de Android | `allowBackup=false` por defecto + reglas explícitas; exportación solo manual |
| WebView | XSS por Markdown/HTML malicioso en una nota importada | Sanitizar con DOMPurify (lista blanca), CSP estricta, sin `eval`, sin HTML crudo sin sanitizar |
| WebView | Puente JS expuesto a páginas ajenas | Sin `addJavascriptInterface` propio; navegación limitada a un *allowlist*; iframes solo de `youtube-nocookie.com`; mensajes del reproductor aceptados solo de ese origen y de su ventana |
| Enlaces pegados | URL hostil en "Pega un enlace de YouTube Music" | Solo hosts de YouTube en lista blanca, IDs validados (`^[A-Za-z0-9_-]{11}$`, listas 10–64); nada más del enlace llega al iframe |
| Importación ZIP/MD | *Zip-slip*, archivos gigantes, YAML hostil | Validar rutas, límites de tamaño/cantidad, parser YAML seguro (sin tipos ejecutables), esquema |
| Share Intent | Texto malicioso entrante | Tratar como no confiable: extraer solo ID de 11 caracteres válido (o URI de Spotify de 22), ignorar el resto |
| Spotify (ADR-013) | Órdenes o datos hostiles por el puente | El plugin solo acepta Client ID `^[0-9a-f]{32}$` y URIs `spotify:(track\|episode\|album\|playlist):[A-Za-z0-9]{22}`; lo que devuelve se valida (`estadoSeguro`). Sin tokens guardados; SDK descargado con SHA256 fijo; keystore de firma solo como secreto de GitHub |
| Cadena de suministro | Dependencia comprometida | Pocas dependencias, `package-lock.json` fijo, `npm audit`, Dependabot, `dependency-review`, revisar permisos de plugins de Capacitor |
| Repositorio público | Secretos filtrados, keystore expuesta | `.gitignore` estricto, `gitleaks`, secretos solo en GitHub Secrets, push protection activado |
| Red | Tráfico en claro / MITM | `cleartextTrafficPermitted=false`; solo HTTPS |
| Privacidad | Fuga a terceros | Sin analíticas ni trackers; `youtube-nocookie.com` para el embed cuando sea posible |

## 3. Configuración Android obligatoria
- Permisos: solo `INTERNET`.
- `android:allowBackup="false"`, `android:usesCleartextTraffic="false"`, `network_security_config.xml` solo HTTPS.
- `android:exported` explícito en cada componente; el único *intent-filter* de entrada es `ACTION_SEND` con `text/plain`.
- `WebView`: `allowFileAccess=false`, `allowContentAccess=false`, `setJavaScriptEnabled` solo lo necesario, sin depuración remota en *release*.
- Build *release*: ofuscación/minificación activada, `debuggable=false`.
- CSP en `index.html`, por ejemplo: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com; connect-src 'self' https://www.youtube.com; object-src 'none'; base-uri 'none'`. Ajustar con evidencia, nunca relajar "por si acaso".

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
**F5:** auditoría completa (sección 5).
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
- Pendiente F5: envolver la clave con Android Keystore (hoy vive no extraíble en IndexedDB de la WebView); bloqueo con biometría/PIN (BiometricPrompt), opcional en Ajustes.
- Exportación cifrada opcional con contraseña (derivación Argon2id/PBKDF2 con parámetros documentados).

## 7. Privacidad
Documentar en `PRIVACIDAD.md`: no hay cuentas, no hay servidor, no hay analíticas; los datos viven en el dispositivo; la única conexión es la del reproductor de YouTube, que está sujeta a las políticas de Google. Con Spotify (ADR-013) la app no se conecta a nada: habla con la app de Spotify del teléfono, que tiene su propia política. Decir qué guarda la app y cómo borrarlo todo.
