/*
 * Icono de la versión de Windows (escritorio/build/icon.png, 512×512) a partir de
 * recursos/icono/marca-ek.svg. electron-builder lo convierte a .ico.
 *
 *   node scripts/icono-escritorio.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const PAPEL = '#FCFCFF';
const TINTA = '#1B1C20';
const svg = readFileSync('recursos/icono/marca-ek.svg', 'utf8')
  .replace(/stroke-width="[\d.]+"/, 'stroke-width="4.2"')
  .replace(/stroke="#[0-9a-fA-F]+"/, `stroke="${TINTA}"`);
const marca = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

// CHROMIUM_RUTA: ejecutable propio si el de Playwright no está descargado.
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_RUTA || undefined });
const pagina = await navegador.newPage();
const b64 = await pagina.evaluate(
  async ({ marca, papel }) => {
    const lado = 512;
    const img = new Image();
    img.src = marca;
    await img.decode();
    const lienzo = new OffscreenCanvas(lado, lado);
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = papel;
    ctx.beginPath();
    ctx.roundRect(0, 0, lado, lado, lado * 0.16);
    ctx.fill();
    const w = lado * 0.62;
    const h = (w * 110) / 140;
    ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
    const bytes = new Uint8Array(await (await lienzo.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  },
  { marca, papel: PAPEL },
);
await navegador.close();
writeFileSync('escritorio/build/icon.png', Buffer.from(b64, 'base64'));
console.log('escritorio/build/icon.png');
