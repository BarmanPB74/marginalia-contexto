# NEGOCIO — cómo funciona Stark, paso a paso

> Documento de contexto del sistema (para el dueño, para el equipo y para cualquier agente de IA).
> Si algo de la app contradice este documento, se corrige la app o se corrige aquí con una decisión
> escrita (ADR en `docs/ARQUITECTURA.md`). Reglas heredadas de BAR BOX, el sistema en Python (`BarmanPB74/Bar_box`).

## 1. Qué es y qué no es
- **Es** el cuaderno del negocio en el teléfono: inventario, ventas con caja, compras a proveedores,
  gastos, pagos de facturas, contabilidad interna y una bitácora (notas + calendario).
- **Funciona sin internet.** Todo vive cifrado en el teléfono. Las copias se sacan a mano (ZIP / CSV).
- **No emite factura electrónica (DIAN).** Lo que imprime o muestra es un comprobante interno. La
  contabilidad oficial la lleva el contador con lo que Stark exporta.

## 2. Personas y permisos
| Rol | Puede | No puede |
|---|---|---|
| **Dueño** | Todo: precios y costos, usuarios, anular ventas, contabilidad, pagos de facturas | — |
| **Cajero** | Abrir y cerrar caja, vender, entradas/retiros de caja, gastos pagados desde la caja, ver inventario (sin costos) | Ver costos y contabilidad, anular, cambiar precios, usuarios |
| **Bodega** | Inventario: conteos, mermas, importar, registrar y aplicar compras | Vender, caja, contabilidad, pagos |
| **Mesero** | Abrir cuentas en las mesas, pedir rondas, marcar «pidió la cuenta», cambiar de mesa | Cobrar, caja, quitar lo pedido, ver inventario, contabilidad |

- Cada persona entra con **su PIN** (4 a 8 dígitos). Tras 5 errores la app espera cada vez más.
- **Todo queda firmado**: cada movimiento guarda quién, cuándo y qué. Nada se borra: se corrige con otro
  movimiento (anulación o ajuste) y ambos quedan a la vista.

## 3. Primer uso (una vez)
1. Abrir Stark → «Crear dueño»: nombre y PIN. (Opcional: Ajustes → bloqueo con huella del teléfono.)
2. **Importar inventario**: Inventario → Importar (Excel o CSV). Sirve el archivo «.xls» que exporta tu
   sistema anterior (es una tabla), un .xlsx o un .csv. La app muestra una vista previa, reconoce las
   columnas (Nombre, Final/Existencia, Precio, Costo, Categoría) y tú confirmas. Los productos que no
   existan se crean; los que existan quedan con la existencia del archivo (ajuste «importación»).
3. Completar en cada producto: **precio de venta**, costo, categoría, unidad y existencia mínima.
4. Crear a los **cajeros** y **bodega** (Más → Usuarios) con su PIN.

## 4. El día a día (el orden importa)
### 4.1 Abrir caja (cajero o dueño)
- Inicio → «Abrir caja» → contar la **base** (efectivo con que se empieza) → Abrir.
- Sin caja abierta no se puede vender. Solo hay una caja abierta a la vez.

### 4.2 Vender
1. Vender → tocar productos (tarjetas con precio y existencias; buscar o filtrar por categoría).
2. Ajustar cantidades; descuento opcional (porcentaje o valor; el dueño decide si el cajero puede).
3. Cobrar: efectivo (escribe lo recibido y la app dice el cambio), tarjeta, transferencia (Nequi,
   Daviplata) o cortesía. Se puede **pagar mixto** (parte efectivo, parte transferencia).
4. Confirmar → la venta queda registrada y **descuenta el inventario** de todos los productos en una
   sola operación (o se guarda todo o no se guarda nada).
5. Errores: solo el dueño **anula** una venta, con motivo; el inventario vuelve. Una venta de una caja
   ya cerrada no se anula: se corrige con un ajuste y una nota en la bitácora.

### 4.3 Movimientos de caja
- **Entrada** (p. ej. sencillo que se trae) y **retiro** (p. ej. se lleva efectivo al banco), con motivo.
- **Gasto pagado desde la caja** (hielo, domicilio, aseo): Gastos → nuevo → «pagado desde la caja».
- **Pago a proveedor desde la caja**: Compras → factura → Pagar → «desde la caja».

### 4.4 Mesas (pedidos por mesa)
1. **Una vez (dueño):** Mesas → «Crear mesas»: varias numeradas (Mesa 1 a Mesa 10) o una con nombre
   (Barra 1), cada una en su **zona** (Salón, Terraza, Barra). El mapa las agrupa por zona.
2. **Llega gente:** Mesas → tocar la mesa → tocar los productos que piden → (nota opcional para la
   barra o la cocina) → «Abrir cuenta y enviar». Cada nuevo pedido es otra **ronda**: se suma a la cuenta.
3. **El mapa dice el estado** con color y texto: *Libre* (verde), *Con pedido* (índigo, con el total y
   hace cuánto fue el último pedido) y *Pidió la cuenta* (ámbar).
4. **Pedir no descuenta inventario.** Lo descuenta el **cobro**, igual que en Vender (efectivo con
   cambio, tarjeta, transferencia, cortesía, mixto; descuento solo el dueño). Al cobrar la mesa queda libre.
5. **Errores:** quitar algo de la cuenta lo hace caja o el dueño, **con motivo** (queda firmado). Una
   cuenta vacía se libera; una con pedidos que no se cobra la **anula el dueño** con motivo (si se
   consumió, mejor cobrarla como *cortesía*: sale del inventario y queda en las ventas).
6. «Cambiar de mesa» mueve la cuenta a una mesa libre.
7. **No se cierra la caja con mesas abiertas:** todo lo servido se cobra (o se anula) en su turno.

### 4.5 Cerrar caja
1. Caja → Cerrar → la app muestra el resumen: ventas por forma de pago, entradas, retiros, gastos y
   pagos desde la caja, y el **efectivo esperado** = base + ventas en efectivo + entradas − retiros −
   gastos y pagos desde la caja.
2. Contar el efectivo real y escribirlo. La **diferencia** (sobrante o faltante) se guarda tal cual, con
   nota. Si no hubo movimientos, se pide un motivo para cerrar.
3. Confirmar. Al cerrar se guarda una «foto» del estado para que la app abra rápido mañana.

## 5. Inventario
- **Existencia** de cada producto = suma de todos sus movimientos (importación, conteos, mermas,
  correcciones, ventas, anulaciones, compras aplicadas).
- **Conteo físico**: Inventario → producto → Contar → escribes lo que hay; la app guarda el ajuste con
  «antes» y «después». Hazlo al menos una vez por semana con los productos que más se mueven.
- **Merma** (se dañó, se venció, se regaló sin venta): ajuste con motivo.
- **Alertas**: existencias negativas (se vendió algo que no estaba registrado) y bajo el mínimo.
  «Sugerido para pedir» = mínimo − existencia, nunca negativo.

## 6. Compras, facturas y pagos
1. Llega el proveedor → Compras → «Nueva factura»: proveedor, número, fecha, vencimiento, renglones
   (producto, cantidad, costo unitario) y **foto o PDF de la factura** (se guarda cifrado).
2. Revisar y **Aplicar**: suma las cantidades al inventario y actualiza el costo de cada producto. Se
   aplica **una sola vez** (la app no deja aplicarla dos veces). Es la única puerta de entrada de
   mercancía de proveedor.
3. **Pagos**: una factura puede pagarse en partes; la app lleva el **saldo**. Las facturas con saldo son
   las **cuentas por pagar** (con su vencimiento).

## 7. Gastos
- Arriendo, servicios, nómina, aseo, domicilios, mantenimiento, otros. Con valor, forma de pago,
  si salió de la caja y foto del soporte (opcional).

## 8. Contabilidad (dueño)
Por día, semana, mes o rango:
- Ventas brutas, descuentos, anulaciones y **ventas netas**; por forma de pago y por producto.
- **Costo de ventas** (con el costo actual de cada producto: es aproximado y la app lo dice) y margen.
- Gastos por categoría, pagos a proveedores, **cuentas por pagar**.
- Cuadres de caja con sus diferencias.
- **Exportar CSV** para el contador o Excel.

## 9. Seguridad y datos
- Todo se guarda **cifrado** (AES-256) con una clave protegida por el chip de seguridad de Android
  (Keystore). Las fotos de facturas también.
- El registro de movimientos es un **diario encadenado**: cada movimiento lleva la huella del anterior;
  si alguien alterara el archivo, la app lo detecta y deja de escribir encima.
- La app no tiene permiso de internet: no envía nada a nadie.
- **Copias**: Ajustes → «Copia completa del negocio (ZIP)» (movimientos, usuarios, inventario y fotos de facturas), ZIP de notas y CSV de contabilidad. En un teléfono nuevo: primer uso → «Restaurar una copia del negocio». Guárdalas fuera del teléfono: si
  el teléfono se pierde o se reinstala la app, solo vuelve lo que esté en una copia.

## 10. Rutina recomendada
| Cuándo | Qué |
|---|---|
| Al abrir | Abrir caja con la base contada |
| Durante el día | Vender; anotar gastos y entradas/retiros apenas pasen; registrar facturas al recibir |
| Al cerrar | Cerrar caja contando el efectivo; revisar alertas de inventario |
| Cada semana | Conteo de los productos que más se mueven; pagar facturas que vencen |
| Cada mes | Contabilidad del mes → exportar CSV al contador; copia de seguridad |

## 11. Para agentes de IA (técnico)
- Núcleo puro en `src/core/negocio/` (diario de eventos con hashes, proyección de estado, permisos,
  PIN, contabilidad); importador en `src/core/negocio/importar/`. Pantallas en `src/features/`.
- Agentes del proyecto en `.claude/agents/`: `arquitecto-negocio`, `ventas-caja`,
  `inventario-compras`, `contable`, `disenador-ui`, `qa-pantallas`, `guardian-seguridad`,
  `publicador-play`. Publicación: `docs/PLAY_CONSOLE.md`.
