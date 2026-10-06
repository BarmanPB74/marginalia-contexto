# Auditoría de seguridad propia — F5 (2026-10-06)

> Solo sobre el código y el APK propios (docs/SEGURIDAD.md §1). Objeto: rama `ccr-4bb4aef6-3n6fty`
> (main + Spotify, PR #3), APK debug de CI `sha256 8c93f42e…5c23`.

## Resumen
- **0 críticos, 0 altos abiertos** en lo que afecta a la app. Los «altos» de MobSF son propios de un APK *debug* (firma de depuración, `debuggable=true`) y se cierran con la build *release* de F6.
- Corregidos en esta fase: 5 (H1–H3, H6, H7 — estos dos por decisión del autor, ADR-014). Aceptados: 3. H4–H5 pasan a F6.
- Fuzzing: 7 pruebas nuevas (`tests/unit/fuzz.test.ts`), ~10 000 entradas hostiles con semilla fija: ningún fallo.

## Herramientas y qué se hizo
| Herramienta | Resultado |
|---|---|
| `npm audit` (producción y desarrollo) | 0 vulnerabilidades tras H1 |
| `osv-scanner` (sobre `package-lock.json`, 368 paquetes) | 0 hallazgos |
| MobSF (Docker, análisis estático del APK) | 0 secretos, 0 rastreadores, 0 dominios incrustados; 1 receptor exportado (AndroidX, protegido por `DUMP`); hallazgos en la tabla |
| `apktool` (manifiesto y recursos decodificados) | Permisos: solo `INTERNET`. `allowBackup=false`, `usesCleartextTraffic=false`, reglas de extracción excluyen todo |
| Semgrep 1.179 (`security-audit`, `xss`, `owasp-top-ten`, `javascript`, `typescript`, `react`, `java`, `secrets`) | 1 aviso: actividad exportada (es el lanzador + Compartir; necesario, ver A2) |
| Revisión manual | Puente nativo (Compartido, Spotify), WebView, CSP, `postMessage`, `dangerouslySetInnerHTML` (solo HTML ya sanitizado), registros (`console.log`/`Log.*`: ninguno) |
| Fuzzing casero | Parser y frontmatter (incl. bomba de alias YAML y etiquetas de tipo), render Markdown (sin HTML ejecutable), enlaces YouTube/Spotify, rutas por hash con `%` mal formados, estado del plugin de Spotify, importador ZIP con bytes al azar y ZIP alterados |
| CodeQL + gitleaks + dependency-review | En CI, verdes |

**No ejecutado aquí (sin teléfono en el entorno):** `adb` (datos en rutas públicas, *logcat*) y Frida. Pasos manuales al final.

## Hallazgos
| # | Hallazgo | Severidad | Evidencia | Corrección | Verificación |
|---|---|---|---|---|---|
| H1 | `uuid` < 11.1.1 (falta de comprobación de límites) vía `@capacitor/cli → xcode`; alerta de Dependabot | Media (solo herramienta de desarrollo para iOS, no entra al APK) | `npm audit`: 3 moderadas; Dependabot #1 | `overrides` en `package.json`: `xcode → uuid 11.1.1` (misma API `v4`) | `npm audit`: 0; `npx cap sync android` funciona |
| H2 | FileProvider de la plantilla de Capacitor con `external-path "."` (todo el almacenamiento externo) | Baja (no exportado; solo con permiso concedido por la app) | `res/xml/file_paths.xml` del APK | Limitado a `external-files-path` + `cache-path`, lo único que usa Capacitor (foto temporal del selector) | Próximo APK de CI; el selector ZIP no usa esas rutas |
| H3 | CSP sin `form-action` | Baja | `index.html` | `form-action 'self'` | e2e en verde |
| H4 | `android:debuggable=true`, firma de depuración, WebView depurable | Alta según MobSF / **aceptada en debug** | MobSF | Build *release* firmada (F6). Capacitor solo activa la depuración de la WebView si la app es *debuggable* | F6: MobSF sobre el APK release |
| H5 | `minSdk 24` (Android 7) permite instalar en versiones sin parches | Baja en este modelo de amenazas | MobSF | Decisión del autor (F6): subir a 26/29 deja fuera teléfonos antiguos | — |
| H6 | La clave de cifrado vive en IndexedDB de la WebView (no extraíble para JS, pero sin Android Keystore) | Media | `src/core/almacen/cifrado.ts`, ADR-008 | **Corregido (ADR-014):** clave envuelta por Android Keystore, migración v1 → v2, clave v1 borrada al terminar | `boveda.test.ts` (7); en el teléfono: `notas/*.md` con cabecera v2 |
| H7 | Sin bloqueo de la app (biometría/PIN): con el teléfono desbloqueado, las notas se leen | Media | Diseño actual | **Corregido (ADR-014):** bloqueo opcional con BiometricPrompt, al abrir y tras 1 min fuera; oculta «recientes» | `candado.test.tsx` (4); probar en el teléfono |
| A1 | `ProfileInstallReceiver` exportado | Info | MobSF | Protegido por `android.permission.DUMP` (solo sistema/adb). Componente de AndroidX | Aceptado |
| A2 | `MainActivity` exportada con `ACTION_SEND text/plain` | Info | Semgrep, manifiesto | Necesaria para Compartir. Texto recortado a 2000 caracteres; solo se aceptan IDs válidos (fuzzing) | Aceptado |
| A3 | Confía en certificados del sistema (no *pinning*) | Info | MobSF | Solo se conecta a YouTube (oEmbed, miniaturas, iframe); *pinning* rompería al rotar sus certificados | Aceptado |

## Comprobaciones MASVS v2 (nivel L1)
| Control | Estado | Evidencia |
|---|---|---|
| STORAGE-1 datos sensibles en almacenamiento privado | ✅ | `Directory.Data`; cifrado AES-256-GCM (ADR-008) |
| STORAGE-2 sin fugas (copias, registros) | ✅ | `allowBackup=false`, reglas de extracción, sin `console.log`/`Log.*` |
| CRYPTO-1 criptografía estándar | ✅ | WebCrypto AES-GCM, IV aleatorio, AAD = ruta; pruebas en `cifrado.test.ts` |
| CRYPTO-2 gestión de claves | ✅ | Clave envuelta por Android Keystore (H6, ADR-014) |
| AUTH | ✅ / n/a | Sin cuentas; bloqueo local opcional con BiometricPrompt (H7). Spotify: autoriza su app, sin tokens |
| NETWORK-1 tráfico seguro | ✅ | `cleartextTrafficPermitted=false`, solo HTTPS, CSP con *allowlist* |
| PLATFORM-1 IPC segura | ✅ | 1 actividad y 1 receptor exportados (A1, A2); FileProvider no exportado (H2) |
| PLATFORM-2 WebView segura | ✅ | `allowFileAccess/ContentAccess=false`, CSP `script-src 'self'`, `postMessage` solo del origen y ventana del reproductor |
| PLATFORM-3 UI | ✅ | Markdown sanitizado (DOMPurify + `html:false`), 22 XSS + fuzzing |
| CODE-1/2 dependencias al día y sin vulnerabilidades | ✅ | `npm audit` 0, `osv-scanner` 0, Dependabot |
| CODE-4 validación de entradas | ✅ | Fuzzing (este informe) |
| PRIVACY-1 mínimo de datos, sin rastreadores | ✅ | MobSF: 0 rastreadores; PRIVACIDAD.md |

## Verificación manual en el teléfono (pendiente del autor)
1. `adb shell run-as io.github.barmanpb74.appnoti head -c 22 files/notas/<id>.md` → `MARGINALIA-CIFRADO v2` (tras abrir la app una vez); `files/claves/notas.v2` existe y es Base64 ilegible.
2. `adb logcat | grep -i marginalia` mientras se escribe una nota → no aparece su texto.
3. `adb shell ls /sdcard/Documents/Marginalia` → solo lo exportado a mano.
