import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// aapt rechaza "--" dentro de un comentario XML y el APK solo se compila en CI: mejor fallar aquí.
const RES = 'android/app/src/main/res';
const xmls = readdirSync(RES, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.xml'))
  .map((f) => join(RES, f));

describe('recursos XML de Android', () => {
  it.each(xmls)('%s: ningún comentario contiene "--"', (ruta) => {
    const comentarios = readFileSync(ruta, 'utf8').match(/<!--[\s\S]*?-->/g) ?? [];
    for (const c of comentarios) expect(c.slice(4, -3), c).not.toContain('--');
  });
});
