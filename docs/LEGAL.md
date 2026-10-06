# LEGAL — cumplimiento, licencias y límites

> Notas técnicas de cumplimiento, no asesoría legal. Ante dudas serias sobre términos de servicio o licencias, consultar a un profesional y leer los textos oficiales vigentes (los términos cambian: verifícalos al llegar a la Fase 4 y a la Fase 6).

## 1. YouTube / YouTube Music
Permitido (vía oficial):
- Incrustar el **YouTube IFrame Player** (API oficial) para reproducir videos que permiten embed.
- Leer metadatos por **oEmbed** público.
- Abrir YouTube Music con un **Intent** a la app oficial.
- Mostrar el reproductor con su interfaz y atribución intactas (no ocultar ni tapar controles, marca o enlaces).

Prohibido (no implementar, no sugerir, no "solo de prueba"):
- Extraer, descargar, grabar o convertir audio/video (`yt-dlp`, NewPipe Extractor, `ytmusicapi`, scraping, servicios de terceros equivalentes).
- Reproducir **solo audio** ocultando el video para evadir el reproductor, o forzar reproducción en segundo plano contra el diseño del reproductor.
- Bloquear/omitir anuncios, o alterar el comportamiento del reproductor.
- Usar credenciales de usuario de Google/YouTube o automatizar su cuenta.
- Almacenar el contenido multimedia en la app. Solo se guardan: ID, título, artista y segundo (metadatos).

Aplicación (2026-10-05): la app lee enlaces de YouTube Music/YouTube que la persona pega (lo que da «Compartir → Copiar enlace»), los reproduce en el iframe oficial visible y con sus controles, y lo controla por `postMessage` (el protocolo de la IFrame API, ADR-010). No hay inicio de sesión ni acceso a la cuenta (no existe API oficial para eso). Al salir de Música el reproductor se desmonta y la música para: no hay audio con el video escondido. Reproductor fuera de Música (ADR-012, opción B elegida por el autor el 2026-10-06): ventana flotante con el **video visible** (264 × 200), por encima de todo, sin nada delante; esconderla a un lado **pausa** la música (nunca audio con el video oculto); cerrarla la para.

Reglas comprobadas el 2026-10-05 en la «Required Minimum Functionality» de la API de YouTube (developers.google.com/youtube/terms/required-minimum-functionality), que limitan ese diseño:
- «Embedded players must have a viewport that is at least 200px by 200px» → el visor de Música tiene `min-width/min-height: 200px` (e2e a 412 y 320 px).
- Nada puede tapar el reproductor ni sus controles (overlays, marcos u otros elementos delante).
- No iniciar la reproducción automática hasta que más de la mitad del reproductor sea visible (el de Música está arriba del todo al abrir).

Share Intent (F4): «Compartir → Marginalia» solo recibe texto plano y la app solo usa un enlace de YouTube con ID válido; no se usa ninguna API no oficial.

Si el reproductor incrustado no es viable en la WebView, se aplica el **Plan B** de `docs/ARQUITECTURA.md` (Intent + Share Intent). Nunca se recurre a una vía no oficial.

## 1 bis. Spotify (ADR-013, 2026-10-06)
Vía oficial: **Spotify App Remote SDK** (Android, Apache-2.0). Marginalia controla la app oficial de Spotify instalada en el teléfono (reproducir, pausar, saltar, leer qué suena y en qué segundo). La música suena **en la app de Spotify**, con su interfaz y sus reglas, y por eso sigue en segundo plano: no se separa ni se oculta nada de ningún reproductor.
- Prohibido igual que con YouTube: descargar, grabar o extraer audio; guardar contenido; usar contraseñas de la persona. Solo se guardan URI, título, artista y segundo.
- Autorización: la pide la app de Spotify (pantalla propia). No hay tokens en Marginalia.
- Términos del Developer Program (verificados 2026-10-06): en **modo desarrollo** la cuenta dueña de la app necesita **Premium** y solo pueden usarla hasta **5** cuentas que el autor añada en el Dashboard. Para más personas hace falta pedir cuota ampliada a Spotify (F6, si se publica).
- El SDK está en beta y Spotify puede cambiarlo; si deja de funcionar, la fuente YouTube no se ve afectada.

**Puesta en marcha (una vez, la hace el autor):**
1. Crea un keystore propio y guárdalo fuera del repo: `keytool -genkeypair -v -keystore marginalia.keystore -alias marginalia -keyalg RSA -keysize 2048 -validity 10000`.
2. En GitHub → Settings → Secrets → Actions: `MARGINALIA_KEYSTORE_B64` = `base64 -w0 marginalia.keystore` y `MARGINALIA_KEYSTORE_PASS` = su contraseña.
3. Lanza CI: el paso «Huella SHA-1 de la firma» imprime la SHA-1.
4. En developer.spotify.com/dashboard crea una app (API: *Android*), con paquete `io.github.barmanpb74.appnoti`, esa SHA-1 y la URI de redirección `marginalia://spotify`. En *User Management* añade tu correo de Spotify.
5. Copia el *Client ID* en Marginalia → Ajustes → Spotify, y en Música elige «Spotify» → «Conectar con Spotify».

## 2. Licencia del proyecto
- Código propio: **MIT** (`LICENSE`, con el nombre del autor y el año). Alternativa: Apache-2.0 (ADR-004).
- Todas las dependencias deben tener licencia compatible (MIT, BSD, Apache-2.0, ISC, MPL-2.0 usada sin modificar). Evitar GPL/AGPL salvo decisión explícita del autor.
- Auditar con `license-checker` (o similar) y guardar el resultado en `docs/seguridad/LICENCIAS.md`.
- Mostrar "Licencias de terceros" en Ajustes.

## 3. Fuentes, iconos e imágenes
- Solo fuentes con licencia **OFL** (o equivalente libre), incluidas en el repo con su archivo de licencia.
- Iconos: dibujados para el proyecto. No copiar iconos de Apple, Google o Notion.
- La **imagen de referencia** (`docs/referencia/estilo-dibujo.jpg`) tiene origen y licencia desconocidos: **no se publica** (está en `.gitignore`) y la app no reproduce su contenido (textos de canción/artista, icono de AirPlay, etc.).
- Capturas del README: solo de la propia app y con datos de ejemplo inventados (no canciones con letra visible, no datos personales).

## 4. Marcas y estilo
- No usar los nombres "Notion", "YouTube", "Google" ni sus logos en el nombre o el icono de la app. En el README se pueden mencionar de forma descriptiva ("compatible con enlaces de YouTube Music") con la aclaración: *"No afiliada ni respaldada por YouTube, Google ni Notion."*
- El diseño es propio: inspiración conceptual (páginas, árbol, notas), interfaz y marca distintas.
- **Icono de la app = marca EK de Eisen-Kern**, del autor (decisión 2026-10-05). Fuente: `recursos/icono/marca-ek.svg` (solo la marca, sin el texto "EISEN-KERN", redibujada a mano en tinta sobre papel); los PNG de `android/app/src/main/res/mipmap-*/ic_launcher*` y las `splash.png` se generan con `node scripts/icono-android.mjs`. **La marca no está bajo la licencia MIT**: todos los derechos reservados (ver README).

## 5. Privacidad y datos
- Sin recolección de datos. `PRIVACIDAD.md` en lenguaje claro (ver `docs/SEGURIDAD.md`, sección 7).
- No incluir notas, canciones ni datos reales del autor en el repositorio, en pruebas ni en capturas.

## 6. Contenido público del repo
Checklist antes de publicar (Fase 6): `LICENSE`, `README.md` (qué es, capturas, instalación del APK, límites conocidos), `SECURITY.md`, `PRIVACIDAD.md`, `CONTRIBUTING.md` corto, aviso de no afiliación, licencias de terceros, historial de git limpio de secretos.
