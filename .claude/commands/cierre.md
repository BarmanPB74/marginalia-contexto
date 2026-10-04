---
description: Cerrar la sesión: verificar, actualizar ESTADO.md y hacer commit
---

Cierre de sesión.

1. Corre lint y tests. Si fallan, arréglalos o anota el fallo exacto en `ESTADO.md`.
2. Actualiza `ESTADO.md` (manteniéndolo < 80 líneas):
   - **Ahora:** fase, estado, fecha de la última sesión, **siguiente paso concreto**.
   - Decisiones nuevas (y ADR en `docs/ARQUITECTURA.md` si cambian la arquitectura).
   - "Probar en el teléfono": pasos cortos y concretos para el autor.
   - Permisos y dependencias nuevas con su justificación.
   - Riesgos abiertos; ideas nuevas al "Banco de ideas".
   - Una línea en "Historial de sesiones".
3. Comprueba que no se colaron secretos ni `docs/referencia/` (`git status`, `gitleaks` si existe).
4. Haz commit(s) pequeños con el formato `tipo(ámbito): resumen`.
5. Responde al autor, en español y en **máximo 8 líneas**: qué quedó hecho, qué falta probar en el teléfono, y cuál es el siguiente paso.
