/*
 * Capturas de aceptación de una fase: las 4 secciones y la galería en Chromium móvil (390×844).
 * Necesita la app servida en :4173 (npm run build && npm run preview -- --port 4173).
 *
 *   node scripts/capturas.mjs [carpeta]   (por defecto capturas/)
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const destino = process.argv[2] ?? 'capturas';
const RUTAS = ['notas', 'calendario', 'musica', 'ajustes', 'galeria'];
mkdirSync(destino, { recursive: true });

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const ruta of RUTAS) {
  await pagina.goto(`http://localhost:4173/#/${ruta}`);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: `${destino}/${ruta}.png`, fullPage: ruta === 'galeria' });
  console.log(`${destino}/${ruta}.png`);
}
await navegador.close();
