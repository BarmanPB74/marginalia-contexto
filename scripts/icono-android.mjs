/*
 * Identidad de Android a partir de recursos/icono/marca-ek.svg (marca EK de Eisen-Kern dibujada a mano):
 * - iconos del lanzador (adaptativo, clásico y redondo) en todas las densidades
 * - pantallas de arranque (splash.png) en vertical y horizontal
 * - color de fondo del icono y del arranque (papel)
 * Usa el Chromium de Playwright para dibujar: no hace falta el SDK de Android ni librerías de imagen.
 *
 *   node scripts/icono-android.mjs
 */
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res';
// Android no lee variables CSS: estos dos valores repiten --papel y --tinta de src/ui/tokens.css
const PAPEL = '#FCFCFF';
const TINTA = '#1B1C20';
const svgFuente = readFileSync('recursos/icono/marca-ek.svg', 'utf8');

/** El mismo dibujo con otro grosor de trazo (en unidades del viewBox de 140×110). */
function marcaConTrazo(grosor) {
  const svg = svgFuente.replace(/stroke-width="[\d.]+"/, `stroke-width="${grosor}"`).replace(/stroke="#[0-9a-fA-F]+"/, `stroke="${TINTA}"`);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// mdpi = 1x … xxxhdpi = 4x
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/*
 * anchoMarca = ancho de la marca respecto al lado del icono.
 * - Adaptativo (Android 8+): capa de 108 dp; el lanzador puede recortar todo menos el círculo central de 66 dp.
 *   La marca (140×110) tiene diagonal ≈ 1.27 × ancho → 0.46 × 108 × 1.27 ≈ 63 dp: cabe en la zona segura.
 *   El fondo de papel lo pone ic_launcher_background (color), así que esta capa es transparente.
 * - Clásico (Android 7): cuadrado de papel de esquinas suaves. Redondo: círculo de papel.
 * En tamaño de icono el trazo fino se pierde: se engruesa a 4.2.
 */
const ICONOS = [
  { archivo: 'ic_launcher_foreground.png', dp: 108, anchoMarca: 0.46, forma: 'ninguna' },
  { archivo: 'ic_launcher.png', dp: 48, anchoMarca: 0.6, forma: 'cuadrado' },
  { archivo: 'ic_launcher_round.png', dp: 48, anchoMarca: 0.56, forma: 'circulo' },
];
const TRAZO_ICONO = 4.2;
const TRAZO_ARRANQUE = 3;

function dimensionesPng(buffer) {
  // Cabecera IHDR: ancho y alto en los bytes 16–23
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

async function dibujar({ ancho, alto, marca, anchoMarca, forma }) {
  const b64 = await pagina.evaluate(
    async ({ ancho, alto, marca, anchoMarca, forma, papel }) => {
      const img = new Image();
      img.src = marca;
      await img.decode();
      const lienzo = new OffscreenCanvas(ancho, alto);
      const ctx = lienzo.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = papel;
      ctx.beginPath();
      if (forma === 'cuadrado') ctx.roundRect(0, 0, ancho, alto, ancho * 0.16);
      else if (forma === 'circulo') ctx.arc(ancho / 2, alto / 2, ancho / 2, 0, Math.PI * 2);
      else if (forma === 'lleno') ctx.rect(0, 0, ancho, alto);
      ctx.fill();
      const w = Math.min(ancho, alto) * anchoMarca;
      const h = (w * 110) / 140;
      ctx.drawImage(img, (ancho - w) / 2, (alto - h) / 2, w, h);
      const blob = await lienzo.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    },
    { ancho, alto, marca, anchoMarca, forma, papel: PAPEL },
  );
  const png = Buffer.from(b64, 'base64');
  const [w, h] = dimensionesPng(png);
  if (w !== ancho || h !== alto) throw new Error(`salió ${w}×${h}, esperaba ${ancho}×${alto}`);
  return png;
}

// Iconos del lanzador
const marcaIcono = marcaConTrazo(TRAZO_ICONO);
for (const [densidad, factor] of Object.entries(DENSIDADES)) {
  for (const v of ICONOS) {
    const lado = Math.round(v.dp * factor);
    const png = await dibujar({ ancho: lado, alto: lado, marca: marcaIcono, anchoMarca: v.anchoMarca, forma: v.forma });
    writeFileSync(`${RES}/mipmap-${densidad}/${v.archivo}`, png);
    console.log(`mipmap-${densidad}/${v.archivo} ${lado}×${lado}`);
  }
}

// Pantallas de arranque: se respetan las medidas que ya tiene cada carpeta
const marcaArranque = marcaConTrazo(TRAZO_ARRANQUE);
for (const carpeta of readdirSync(RES).filter((c) => c === 'drawable' || c.startsWith('drawable-'))) {
  const ruta = `${RES}/${carpeta}/splash.png`;
  let actual;
  try {
    actual = readFileSync(ruta);
  } catch {
    continue;
  }
  const [ancho, alto] = dimensionesPng(actual);
  writeFileSync(ruta, await dibujar({ ancho, alto, marca: marcaArranque, anchoMarca: 0.32, forma: 'lleno' }));
  console.log(`${carpeta}/splash.png ${ancho}×${alto}`);
}

writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <!-- Papel de Marginalia (token papel); generado por scripts/icono-android.mjs -->\n    <color name="ic_launcher_background">${PAPEL}</color>\n</resources>\n`,
);
await navegador.close();
