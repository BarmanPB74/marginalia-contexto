# LEGAL — cumplimiento, licencias y límites

> Notas técnicas de cumplimiento, no asesoría legal. Ante dudas serias sobre términos de servicio o licencias, consultar a un profesional y leer los textos oficiales vigentes (los términos cambian: verifícalos al llegar a la Fase 4 y a la Fase 6).

## 1. Música (retirada, ADR-015, 2026-10-16)
La app ya no reproduce música: el reproductor de YouTube (ADR-003/010/012) y Spotify App Remote
(ADR-013) se quitaron al convertir la app en **Stark** (inventario y ventas). Motivos: publicación
en Play más simple, sin red ni SDK de terceros (Spotify en modo desarrollo solo admite 5 cuentas).
El historial de git conserva esa implementación.

## 1 bis. Facturación electrónica
Stark **no emite factura electrónica** (DIAN, Colombia) ni la presenta como tal. Sus comprobantes son
internos. Para facturar electrónicamente hace falta un proveedor tecnológico autorizado; si algún día se
integra, será con un ADR y revisión legal.

## 1 ter. Datos de terceros importados
Al importar un inventario desde otro sistema, Stark solo lee la tabla y no guarda el nombre ni la marca
del sistema de origen. Ningún dato real del negocio se sube al repositorio (es público): las pruebas usan
datos inventados.

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
- No usar nombres ni logos de terceros (Notion, Google, sistemas POS de otras empresas, Nequi, Daviplata…) en el nombre o el icono de la app. Se pueden mencionar formas de pago de forma descriptiva.
- El diseño es propio: inspiración conceptual (páginas, árbol, notas), interfaz y marca distintas.
- **Icono de la app = marca EK de Eisen-Kern**, del autor (decisión 2026-10-05). Fuente: `recursos/icono/marca-ek.svg` (solo la marca, sin el texto "EISEN-KERN", redibujada a mano en tinta sobre papel); los PNG de `android/app/src/main/res/mipmap-*/ic_launcher*` y las `splash.png` se generan con `node scripts/icono-android.mjs`. **La marca no está bajo la licencia MIT**: todos los derechos reservados (ver README).

## 5. Privacidad y datos
- Sin recolección de datos. `PRIVACIDAD.md` en lenguaje claro (ver `docs/SEGURIDAD.md`, sección 7).
- No incluir notas, canciones ni datos reales del autor en el repositorio, en pruebas ni en capturas.

## 6. Contenido público del repo
Checklist antes de publicar (Fase 6): `LICENSE`, `README.md` (qué es, capturas, instalación del APK, límites conocidos), `SECURITY.md`, `PRIVACIDAD.md`, `CONTRIBUTING.md` corto, aviso de no afiliación, licencias de terceros, historial de git limpio de secretos.
