# Política de privacidad de Bar Box

*Vigente desde el 16 de octubre de 2026. Responsable: Pablo (BarmanPB74), desarrollador de Bar Box.*

**Bar Box no recoge, no envía y no comparte ningún dato.** La app no tiene permiso de internet:
todo lo que escribes se queda en tu teléfono.

## Qué guarda la app y dónde
- **Datos del negocio**: productos, existencias, ventas, cajas, compras, facturas de proveedor (con sus
  fotos o PDF), pagos, gastos, usuarios del equipo y la bitácora (notas y calendario).
- Se guardan solo en el **almacenamiento privado de la app** en tu teléfono, **cifrados** (AES-256-GCM)
  con una clave protegida por el almacén de claves de Android (Keystore). Otras apps no pueden leerlos.
- **PIN de cada usuario**: no se guarda el PIN, solo una huella derivada (PBKDF2) que no permite
  recuperarlo.
- **Preferencias** (tema, vista): en el teléfono.
- **Bloqueo con huella o rostro (opcional)**: lo hace Android con su propio diálogo. Bar Box nunca ve ni
  guarda datos biométricos: solo recibe «sí» o «no».

## Qué sale del teléfono
Nada, salvo lo que **tú** exportes a mano (copia ZIP de notas, CSV de contabilidad, una nota en .md,
.txt o .html). Esas copias van **sin cifrar** para que otras apps las puedan abrir: guárdalas en un
lugar seguro. No hay copias automáticas en la nube (las copias de seguridad de Android están
desactivadas para esta app).

## Terceros
Bar Box no usa servicios de terceros, anuncios, analíticas ni rastreadores.

## Niños
Bar Box es una herramienta de trabajo para negocios; no está dirigida a menores de 18 años.

## Cómo borrarlo todo
Desinstala la app, o en Android: *Ajustes → Apps → Bar Box → Almacenamiento → Borrar datos*. Al
hacerlo, los datos no se pueden recuperar salvo desde una copia que hayas exportado.

## Cambios y contacto
Si esta política cambia, se actualizará este documento y la fecha de arriba. Preguntas: abre un
*issue* en https://github.com/BarmanPB74/marginalia-contexto.
