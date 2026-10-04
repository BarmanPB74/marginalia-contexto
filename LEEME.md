# Paquete de contexto para Claude Code

Este paquete le da a Claude Code **memoria del proyecto** en cada sesión, sin que tengas que volver a explicar nada.

## Cómo funciona
- `CLAUDE.md` es lo primero que Claude Code lee en cada sesión: visión, reglas, stack, mapa de carpetas y protocolo. Importa `ESTADO.md`, que es la memoria viva (en qué fase vamos, qué se decidió, qué sigue).
- `docs/` contiene las notas de contexto por tema. Claude solo lee las que necesita (así no se llena el contexto).
- `.claude/commands/` son atajos: `/inicio`, `/fase`, `/auditar`, `/cierre`.
- `.claude/settings.json` muestra `ESTADO.md` automáticamente al abrir cada sesión.

## Cómo usarlo
1. Crea un repositorio **vacío** en GitHub (público).
2. Copia todo este paquete a la raíz del repo (incluida la carpeta oculta `.claude/` y `.gitignore`).
3. Pon tu imagen de referencia en `docs/referencia/estilo-dibujo.jpg` (ya está ignorada por git: no se publica).
4. Abre Claude Code sobre ese repo y pega el contenido de `PROMPT_INICIAL.md`.
5. En cada sesión posterior: `/inicio` → confirmas el plan → `/fase N` → `/auditar` → `/cierre`.

## Qué esperar (con honestidad)
- Claude Code puede escribir, probar en navegador headless y compilar el APK en GitHub Actions. **No puede probar en tu teléfono**: al final de cada fase te dejará en `ESTADO.md` una lista corta de cosas por probar tú.
- El punto más incierto técnicamente es el reproductor de YouTube dentro de la WebView; por eso se hace un *spike* en F0 y hay un Plan B legal documentado.
- Ajusta los documentos cuando cambies de idea: si no está en `ESTADO.md`/`docs/`, Claude no lo recordará.
