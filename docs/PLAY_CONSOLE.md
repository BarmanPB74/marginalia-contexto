# Publicar Bar Box en Google Play Console

> Guía paso a paso para el dueño. Lo técnico ya está preparado en el repositorio (ADR-015):
> flujo `.github/workflows/release.yml`, firma por secretos, R8, versionCode creciente.
> Verifica siempre las reglas vigentes en https://support.google.com/googleplay/android-developer
> (cambian; esta guía se escribió el 2026-10-16).

## 0. Lo que ya está listo
| Requisito de Play | Estado en Bar Box |
|---|---|
| Formato AAB firmado | `release.yml` genera `app-release.aab` + `.apk` + `SHA256SUMS.txt` |
| targetSdk reciente | 36 (`android/variables.gradle`) |
| versionCode creciente | `100 + número de ejecución` del flujo |
| Código reducido | R8 + recursos sin usar fuera (`minifyEnabled`, `shrinkResources`) |
| Permisos | Ninguno peligroso. **Sin INTERNET** (la app no se conecta a nada). Solo `USE_BIOMETRIC`/`USE_FINGERPRINT` para el bloqueo opcional |
| Pantallas | Teléfonos, plegables y tabletas, vertical y horizontal (`resizeableActivity`, `supports-screens`) |

## 1. Crear tu llave de subida (una sola vez, en tu PC o Termux con Java)
```sh
keytool -genkeypair -v -keystore barbox-subida.jks -alias barbox \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 barbox-subida.jks > barbox-subida.b64
```
- Guarda `barbox-subida.jks` y su contraseña en dos lugares seguros (fuera del repositorio). Si la pierdes, Play permite cambiar la llave de subida, pero es un trámite.
- En GitHub → *Settings → Secrets and variables → Actions → New repository secret*:
  - `BARBOX_KEYSTORE_B64` = contenido de `barbox-subida.b64`
  - `BARBOX_KEYSTORE_PASS` = la contraseña
- Borra `barbox-subida.b64` después.

## 2. Compilar la versión para Play
GitHub → *Actions → «Publicación (AAB para Play Console)» → Run workflow* → escribe la versión (`1.0.0`).
Descarga el artefacto `barbox-release-1.0.0`: trae el `.aab` (para Play), un `.apk` firmado (para probar en tu teléfono) y las huellas SHA-256.

## 3. Cuenta y app en Play Console
1. Cuenta de desarrollador (pago único). Si la cuenta es **personal y nueva**, Google exige una **prueba cerrada con al menos 12 personas durante 14 días** antes de poder publicar en producción: invita a tus empleados o conocidos.
2. *Crear app* → Nombre: **Bar Box** · Idioma: Español (Latinoamérica) · App · Gratis.
3. Acepta **Firma de apps de Google Play** (Google guarda la llave final; tú solo subes con la tuya).

## 4. Ficha de Play Store (borrador)
- **Descripción corta (≤ 80):** `Inventario, ventas y caja para tu café o bar, sin internet y con tus datos cifrados.`
- **Descripción completa:**
  > Bar Box es el cuaderno de tu negocio en el teléfono.
  > • Inventario: importa tu inventario desde Excel o CSV, cuenta a mano, registra mermas y recibe alertas de existencias bajas.
  > • Ventas y caja: abre la caja con la base, vende en pocos toques, cobra en efectivo, tarjeta o transferencia (Nequi, Daviplata) y cierra con el cuadre automático. Cada venta descuenta el inventario.
  > • Compras y gastos: registra las facturas de tus proveedores con foto o PDF, súmalas al inventario y lleva sus pagos. Anota los gastos del día.
  > • Contabilidad: ventas, costos, gastos y cuentas por pagar por día, semana o mes. Exporta a CSV para tu contador.
  > • Equipo: dueño, cajeros y bodega, cada uno con su PIN y sus permisos. Todo queda registrado: quién hizo qué y cuándo.
  > • Bitácora: notas y calendario del negocio.
  > • Privado: funciona sin internet, todo se guarda cifrado en tu teléfono y puedes bloquearlo con huella.
  > Bar Box no emite factura electrónica: es un registro interno de apoyo.
- **Categoría:** Empresa (Business). **Etiquetas:** inventario, punto de venta.
- **Gráficos:** icono 512×512 PNG, gráfico destacado 1024×500, 2–8 capturas de teléfono y de tableta de 7" y 10" (las de `capturas/diseno/` sirven de base).

## 5. Contenido de la app (formularios obligatorios)
- **Política de privacidad:** publica `PRIVACIDAD.md` (p. ej. con GitHub Pages) y pega la URL.
- **Seguridad de los datos:** la app **no recopila ni comparte datos** (no hay red: nada sale del teléfono). Marca: «No se recopilan datos» · «No se comparten datos». Cifrado: sí (en el dispositivo). Eliminación: desinstalar o borrar datos de la app.
- **Anuncios:** No. · **Acceso a la app:** todas las funciones disponibles sin cuenta (el PIN se crea en el primer uso; si Google pide credenciales de revisión, indica «crear dueño con cualquier PIN en el primer uso»).
- **Clasificación de contenido:** categoría *Utilidad, productividad, comunicación u otras*; respuestas «No» a violencia, sexo, apuestas, etc. Aunque sea para un bar, la app no vende alcohol a usuarios: es una herramienta interna.
- **Público objetivo:** 18+ (uso profesional).
- **App de finanzas:** no es una app de préstamos ni de servicios financieros; si pregunta, «No».

## 6. Lanzamiento
1. *Pruebas → Prueba interna* → sube el `.aab` → añade tu correo → instala desde el enlace en tu teléfono y prueba la lista de `ESTADO.md`.
2. *Prueba cerrada* (si la cuenta lo exige: 12 personas, 14 días).
3. *Producción* → revisión de Google (de horas a días).
4. Para cada actualización: Run workflow con una versión mayor (`1.0.1`) y sube el nuevo `.aab`.

## 7. Antes de cada subida (lo revisa el agente `publicador-play`)
- [ ] CI en verde y `release.yml` en verde.
- [ ] Probado el `.apk` firmado en un teléfono real (y una tableta o modo horizontal).
- [ ] Permisos del APK = los de esta guía (`aapt dump permissions` o MobSF).
- [ ] Textos de la ficha sin prometer factura electrónica.
