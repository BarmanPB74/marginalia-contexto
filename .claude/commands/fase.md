---
description: Ejecutar (o continuar) una fase del plan. Uso: /fase [número]
argument-hint: "[número de fase, opcional]"
---

Ejecuta la fase indicada: **$ARGUMENTS** (si está vacío, usa la fase actual de `ESTADO.md`).

Reglas:
1. Lee la sección de esa fase en `docs/FASES.md` y los documentos de `docs/` que necesite.
2. Trabaja con el ciclo **explicar → construir → probar → mejorar**. Antes de cada decisión técnica importante, explica en 2–3 líneas el porqué (el autor está aprendiendo).
3. No salgas del alcance de la fase. Las ideas nuevas van al "Banco de ideas" de `ESTADO.md`.
4. Respeta las reglas inquebrantables de `CLAUDE.md` (legalidad, local-first, permisos, sanitización, diseño).
5. Escribe pruebas junto al código. Corre lint y tests antes de dar algo por hecho.
6. Si algo no puede verificarse en este entorno, anótalo en "Probar en el teléfono" de `ESTADO.md`.
7. Verifica versiones actuales de librerías en su documentación oficial; no las supongas.
8. Al terminar el bloque de trabajo: ejecuta la lógica de `/auditar` para esta fase y luego `/cierre`.

Si la ambigüedad es costosa (cambia arquitectura, añade permisos o dependencias pesadas), pregunta antes. Si es menor, decide, y déjalo anotado en `ESTADO.md`.
