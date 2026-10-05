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

describe('manifiesto de Android', () => {
  const manifiesto = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

  it('solo pide INTERNET (CLAUDE.md regla 3)', () => {
    expect([...manifiesto.matchAll(/uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'android.permission.INTERNET',
    ]);
  });

  it('las únicas entradas son abrir la app y recibir texto plano compartido', () => {
    const acciones = [...manifiesto.matchAll(/<action android:name="([^"]+)"/g)].map((m) => m[1]);
    expect(acciones).toEqual(['android.intent.action.MAIN', 'android.intent.action.SEND']);
    expect([...manifiesto.matchAll(/android:mimeType="([^"]+)"/g)].map((m) => m[1])).toEqual(['text/plain']);
    for (const c of manifiesto.match(/<!--[\s\S]*?-->/g) ?? []) expect(c.slice(4, -3)).not.toContain('--');
  });
});
