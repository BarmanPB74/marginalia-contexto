---
description: Pasar la Puerta de seguridad de la fase actual (solo sobre este proyecto)
---

Ejecuta la **Puerta de seguridad** de la fase actual.

1. Lee `docs/SEGURIDAD.md` (§4 "Siempre" + la fila de la fase actual) y `docs/LEGAL.md` (§1 y §2).
2. Ejecuta lo que sea ejecutable: `npm audit --omit=dev`, lint, tests, `gitleaks` (si está instalado; si no, indícalo), comprobación de permisos en `AndroidManifest.xml`, búsqueda de `innerHTML`, `eval`, `dangerouslySetInnerHTML` y URLs `http://`.
3. Revisa a mano: dependencias nuevas desde el último cierre (licencia, mantenimiento), cambios en el manifiesto, CSP, rutas de archivos.
4. Entrega una tabla **ítem → ✅ / ❌ / ⚠️ no verificable aquí → evidencia (comando o archivo)**.
5. Corrige lo que sea corrección pequeña y dentro de la fase; lo demás, regístralo como riesgo en `ESTADO.md`.

Límites éticos: solo código, builds y dispositivos del propio proyecto. Nunca pruebes ni escanees servicios de terceros (incluido YouTube/Google).
