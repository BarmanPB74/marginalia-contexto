# Marginalia

Cuaderno de notas en Markdown para Android, local-first: limpio como el sistema de Android, con trazo dibujado a mano, en claro y en oscuro.

> **Estado:** en construcción (Fase 2 — Notas). Versión de avance, sin publicar.

## Qué es
- Notas en Markdown organizadas en páginas y subpáginas, vistas como **tarjetas tipo apps recientes** o como lista.
- Plantillas: nota rápida, **bitácora**, reunión.
- **Calendario**: cada `@fecha` de una nota la pone en su día; desde un día se crea su bitácora.
- **Paleta de comandos**: busca notas, ajustes y herramientas escribiendo su nombre.
- **Música de YouTube Music**: pega el enlace de una canción, álbum o lista y suena en el reproductor oficial incrustado, con un globo que se esconde a un lado.
- **Notas cifradas** (AES-256-GCM) en el teléfono desde que se crean; al exportarlas (Markdown, texto, HTML) salen legibles.
- Todo vive en tu teléfono: sin cuentas, sin servidor, sin analíticas.

## Desarrollo
Requiere Node.js 22 o superior.

```
npm ci
npm run dev        # servidor local
npm run build      # build web
npm run lint
npm test           # pruebas unitarias
npm run test:e2e   # pruebas e2e (Playwright)
npm run audit      # vulnerabilidades en dependencias de producción
npx cap sync android
```

El APK debug se construye en GitHub Actions y se descarga como artefacto del flujo **CI**.

## Documentación
El contexto del proyecto está en [`CLAUDE.md`](CLAUDE.md), [`ESTADO.md`](ESTADO.md) y [`docs/`](docs/).
Privacidad: [`PRIVACIDAD.md`](PRIVACIDAD.md) · Seguridad: [`SECURITY.md`](SECURITY.md).

## Aviso
No afiliada ni respaldada por YouTube, Google ni Notion.

## Licencia
[MIT](LICENSE) © 2026 Pablo

La licencia MIT cubre el código. **El logo y la marca EK de Eisen-Kern** (`recursos/icono/` y los iconos del lanzador en `android/app/src/main/res/mipmap-*/`) **no** están incluidos: © 2026 Pablo, todos los derechos reservados. Si haces un fork, usa tu propio icono.
