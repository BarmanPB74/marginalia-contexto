/*
 * Genera los iconos del lanzador de Android a partir de recursos/icono/marca-ek.png
 * (marca EK de Eisen-Kern, sin texto, crema sobre transparente).
 * Usa el Chromium de Playwright para dibujar: no hace falta el SDK de Android ni librerías de imagen.
 *
 *   node scripts/icono-android.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res';
const FONDO = '#000000'; // el negro del logo original
const marca = 'data:image/png;base64,' + readFileSync('recursos/icono/marca-ek.png').toString('base64');

// mdpi = 1x … xxxhdpi = 4x
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/*
 * Ancho de la marca respecto al lado del icono.
 * - Adaptativo (Android 8+): capa de 108 dp; el lanzador puede recortar todo menos el círculo central de 66 dp.
 *   La marca (330×253) tiene diagonal ≈ 1.26 × ancho → 0.46 × 108 × 1.26 ≈ 63 dp: cabe en la zona segura.
 * - Clásico (Android 7): cuadrado negro de esquinas suaves, marca más grande.
 * - Redondo: círculo negro; diagonal 0.56 × 1.26 ≈ 0.71 del diámetro.
 */
const VARIANTES = [
  { archivo: 'ic_launcher_foreground.png', dp: 108, anchoMarca: 0.46, forma: 'ninguna' },
  { archivo: 'ic_launcher.png', dp: 48, anchoMarca: 0.62, forma: 'cuadrado' },
  { archivo: 'ic_launcher_round.png', dp: 48, anchoMarca: 0.56, forma: 'circulo' },
];

function ladoPng(buffer) {
  // Cabecera IHDR: ancho y alto en los bytes 16–23
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

for (const [densidad, factor] of Object.entries(DENSIDADES)) {
  for (const v of VARIANTES) {
    const lado = Math.round(v.dp * factor);
    const b64 = await pagina.evaluate(
      async ({ marca, lado, anchoMarca, forma, fondo }) => {
        const img = new Image();
        img.src = marca;
        await img.decode();
        const lienzo = new OffscreenCanvas(lado, lado);
        const ctx = lienzo.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = fondo;
        if (forma === 'cuadrado') {
          ctx.beginPath();
          ctx.roundRect(0, 0, lado, lado, lado * 0.16);
          ctx.fill();
        } else if (forma === 'circulo') {
          ctx.beginPath();
          ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        // marca-ek.png es cuadrada y la marca ocupa todo su ancho
        const ancho = lado * anchoMarca;
        ctx.drawImage(img, (lado - ancho) / 2, (lado - ancho) / 2, ancho, ancho);
        const blob = await lienzo.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s);
      },
      { marca, lado, anchoMarca: v.anchoMarca, forma: v.forma, fondo: FONDO },
    );
    const png = Buffer.from(b64, 'base64');
    const [ancho, alto] = ladoPng(png);
    if (ancho !== lado || alto !== lado) throw new Error(`${densidad}/${v.archivo}: ${ancho}×${alto}, esperaba ${lado}`);
    writeFileSync(`${RES}/mipmap-${densidad}/${v.archivo}`, png);
    console.log(`mipmap-${densidad}/${v.archivo} ${lado}×${lado}`);
  }
}

writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${FONDO}</color>\n</resources>\n`,
);
await navegador.close();
