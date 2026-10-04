# Marginalia

Cuaderno de notas en Markdown para Android, local-first, con estética de papel dibujado a mano.

> **Estado:** en construcción (Fase 0 — Cimientos). Todavía no hay funciones de notas.

## Qué es
- Notas en Markdown organizadas en páginas.
- Etiquetas de fecha que aparecen en un calendario.
- Notas asociadas a una canción (y al segundo exacto) usando el reproductor oficial incrustado de YouTube.
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
