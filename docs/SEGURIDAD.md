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
| Notas del usuario | Teléfono perdido o prestado | Almacenamiento privado de la app; bloqueo biométrico opcional; cifrado opcional; `FLAG_SECURE` opcional |
| Notas del usuario | Copias de seguridad automáticas de Android | `allowBackup=false` por defecto + reglas explícitas; exportación solo manual |
| WebView | XSS por Markdown/HTML malicioso en una nota importada | Sanitizar con DOMPurify (lista blanca), CSP estricta, sin `eval`, sin HTML crudo sin sanitizar |
| WebView | Puente JS expuesto a páginas ajenas | Sin `addJavascriptInterface` propio; navegación limitada a un *allowlist*; iframes solo de `youtube.com`/`youtube-nocookie.com` |
| Importación ZIP/MD | *Zip-slip*, archivos gigantes, YAML hostil | Validar rutas, límites de tamaño/cantidad, parser YAML seguro (sin tipos ejecutables), esquema |
| Share Intent | Texto malicioso entrante | Tratar como no confiable: extraer solo ID de 11 caracteres válido, ignorar el resto |
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
- CSP en `index.html`, por ejemplo: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https://www.youtube.com; object-src 'none'; base-uri 'none'`. Ajustar con evidencia, nunca relajar "por si acaso".

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

## 6. Cifrado y bloqueo (decisión en F5, ADR propio)
- Bloqueo de la app con biometría/PIN del dispositivo (BiometricPrompt) — opcional, activable en Ajustes.
- Cifrado en reposo opcional: **no inventar criptografía**. Usar SQLCipher/Android Keystore o WebCrypto AES-GCM con clave en Keystore; documentar el diseño y qué NO protege (p. ej. dispositivo con root).
- Exportación cifrada opcional con contraseña (derivación Argon2id/PBKDF2 con parámetros documentados).

## 7. Privacidad
Documentar en `PRIVACIDAD.md`: no hay cuentas, no hay servidor, no hay analíticas; los datos viven en el dispositivo; la única conexión es la del reproductor de YouTube, que está sujeta a las políticas de Google. Decir qué guarda la app y cómo borrarlo todo.
