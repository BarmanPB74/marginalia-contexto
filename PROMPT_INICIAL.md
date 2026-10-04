# PROMPT_INICIAL — pégalo en Claude Code (sesión 1)

Antes de pegarlo: el repo debe contener este paquete (`CLAUDE.md`, `ESTADO.md`, `docs/`, `.claude/`) y la imagen en `docs/referencia/estilo-dibujo.jpg`.

---

```
Vas a construir, junto conmigo y por fases, una app Android local-first de notas y estudio en Markdown, que publicaremos como repositorio público en GitHub.

CONTEXTO
Todo el contexto del proyecto está en este repositorio. Empieza leyendo, en este orden:
1. CLAUDE.md (reglas, stack, estructura, protocolo de sesión)
2. ESTADO.md
3. docs/FASES.md — SOLO la sección F0
4. docs/PRODUCTO.md, docs/ARQUITECTURA.md, docs/SEGURIDAD.md y docs/LEGAL.md
5. Mira la imagen docs/referencia/estilo-dibujo.jpg y lee docs/DISENO.md (la usaremos en F1; por ahora solo quiero que la conozcas)

LO QUE QUIERO EN ESTA SESIÓN
Ejecutar únicamente la Fase 0 (Cimientos). No construyas funciones de notas, calendario ni música todavía.

CÓMO QUIERO QUE TRABAJES
- Responde siempre en español.
- Ciclo: explicar → construir → probar → mejorar. Explícame brevemente el porqué de cada decisión técnica; estoy aprendiendo.
- Divide el trabajo en pasos pequeños y verificables. Máximo 5 pasos por sesión.
- Antes de escribir código, dame: (a) un plan de ≤ 5 pasos, (b) tus supuestos, (c) máximo 3 preguntas que de verdad cambien lo que harás (nombre del proyecto y licencia están pendientes). Si algo es menor, decide tú y anótalo en ESTADO.md.
- Verifica en la documentación oficial las versiones actuales de Vite, Preact, Capacitor y GitHub Actions; no las des por sabidas.
- Si algo no se puede verificar en tu entorno (probar en un teléfono real), dilo y déjame los pasos exactos en "Probar en el teléfono" de ESTADO.md.
- No añadas nada fuera del alcance de la fase. Las ideas nuevas van al "Banco de ideas".

LÍMITES NO NEGOCIABLES
- Legalidad: solo el reproductor oficial incrustado de YouTube; nada de extraer o descargar audio/video, ni APIs no oficiales (detalle en docs/LEGAL.md).
- Privacidad: los datos nunca salen del dispositivo; sin analíticas ni cuentas; permiso Android solo INTERNET.
- Seguridad: pasa la Puerta de seguridad de F0 (docs/SEGURIDAD.md §4). Nunca subas secretos, keystores ni la imagen de referencia.
- Pruebas de seguridad solo sobre este proyecto y mis dispositivos, nunca sobre servicios de terceros.

ENTREGABLE DE ESTA SESIÓN
Lo definido en F0 de docs/FASES.md: repo con licencia y archivos de seguridad, proyecto Vite + Preact + TypeScript + Capacitor, CI que compile un APK debug descargable, y el resultado del spike del reproductor de YouTube en WebView anotado en ESTADO.md.

AL TERMINAR
Ejecuta la lógica de /auditar y luego /cierre: actualiza ESTADO.md, haz commits pequeños y dime en ≤ 8 líneas qué quedó hecho, qué debo probar en el teléfono y cuál es el siguiente paso.

Empieza con /inicio: resume el contexto que cargaste y propón el plan.
```

---

## Prompts de las sesiones siguientes (cortos; el contexto ya está en el repo)

- **Retomar:** `/inicio`
- **Avanzar una fase:** `/fase 1` (o 2, 3, 4, 5, 6)
- **Revisar seguridad:** `/auditar`
- **Cerrar:** `/cierre`

Si algo se desvía, dilo así: *"Relee CLAUDE.md y ESTADO.md; te saliste del alcance de la fase actual. Revierte lo que no corresponde y propón el plan de nuevo."*
