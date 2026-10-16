# Stark en Windows (prueba en el bar)

> ADR-017. La misma app del teléfono, empaquetada con Electron para un PC con Windows 10 u 11 (64 bits).
> Se compila sola en GitHub: *Actions → «Escritorio (Windows)»*. Artefacto `stark-windows-<versión>`.

## 1. Qué archivo usar
| Archivo | Para qué |
|---|---|
| `Stark-Instalador-1.0.0.exe` | **Recomendado.** Instala Stark para el usuario de Windows, con acceso directo en el escritorio y en Inicio. Se desinstala desde *Configuración → Aplicaciones*. |
| `Stark-Portable-1.0.0.exe` | Abre sin instalar (p. ej. desde una USB). Los datos quedan igual en el PC, no en la USB. |
| `SHA256SUMS.txt` | Huellas para comprobar que el archivo no cambió (`certutil -hashfile Stark-Instalador-1.0.0.exe SHA256`). |

## 2. Instalar
1. Descarga y descomprime el artefacto. Doble clic en `Stark-Instalador-1.0.0.exe`.
2. **Windows SmartScreen** dirá «Windows protegió su PC» porque el instalador no está firmado con un
   certificado de pago: *Más información → Ejecutar de todos modos*. (Para una versión comercial se
   compra un certificado de firma de código; ver §6.)
3. Elige la carpeta (o deja la propuesta) → Instalar → abre **Stark** desde el escritorio.
4. Primer uso igual que en el teléfono (`docs/NEGOCIO.md` §3): crear dueño con PIN, importar inventario,
   crear cajeros.

## 3. Dónde quedan los datos
- En `%APPDATA%\Stark` (cuenta de Windows de quien la usa), **cifrados** con AES-256-GCM. La clave se
  protege con **DPAPI** de Windows (`safeStorage`): solo esa cuenta de Windows en ese PC puede abrirla.
- Consecuencia: si se reinstala Windows o se cambia de cuenta, los datos **no** se pueden abrir. La única
  salida es una copia (§4).
- Desinstalar **no** borra los datos (por seguridad). Para borrarlos: desinstalar y borrar la carpeta
  `%APPDATA%\Stark`.
- Sin internet: la ventana bloquea toda conexión externa y ningún permiso (cámara, micrófono, ubicación).

## 4. Copias durante la prueba (importante)
- **Cada noche, tras cerrar la caja:** Ajustes → «Copia completa del negocio (ZIP)». Windows pregunta
  dónde guardarla (propone `Documentos\Stark`). Guárdala también en una USB o en tu correo.
- Para pasar los datos a otro PC o al teléfono: instalar Stark allí → primer uso → «Restaurar una copia
  del negocio».
- La copia sale **legible** (no cifrada): guárdala como guardarías el cuaderno de caja.

## 5. Uso en el bar
- Una sola ventana a la vez (si se abre dos veces, vuelve a la que ya está abierta).
- Cerrar la ventana pide confirmación. Todo lo registrado ya está guardado; la caja abierta sigue
  abierta al volver.
- Pantalla grande: riel lateral y filtros al lado. Se puede usar con ratón, teclado o pantalla táctil.
- Cada persona entra con su PIN; la sesión se cierra tras 10 minutos con la ventana minimizada.
- La cámara de facturas no se usa en el PC: adjunta la foto o el PDF desde un archivo.

## 6. Pendiente para una versión comercial
- Firma de código (certificado OV/EV) para que SmartScreen no avise.
- Actualizaciones automáticas (hoy: instalar encima la versión nueva; los datos se conservan).
- Impresora de comprobantes.

## 7. Técnico
- `escritorio/main.cjs`: protocolo `app://stark/` sobre `web/` (copia de `dist/`), `contextIsolation`,
  `sandbox`, sin `nodeIntegration`, red bloqueada (`webRequest`), permisos denegados, navegación fuera
  del origen bloqueada, enlaces https al navegador del sistema, instancia única.
- `escritorio/preload.cjs`: único puente, `window.stark.boveda` (envolver/desenvolver la clave con
  safeStorage). La app lo usa en `src/features/notas/contexto.tsx` igual que el Keystore de Android.
- Dependencias de compilación (no viajan en la app salvo Electron): `electron` 44 (MIT),
  `electron-builder` 26 (MIT). `npm audit` marca avisos moderados en `sprintf-js` dentro de
  electron-builder: solo en la compilación, no en el instalador.
- Icono: `node scripts/icono-escritorio.mjs` → `escritorio/build/icon.png`.
