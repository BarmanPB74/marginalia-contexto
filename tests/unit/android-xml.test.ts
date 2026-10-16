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

  it('no pide ningún permiso propio: sin INTERNET (ADR-015); el bloqueo lo añade androidx.biometric al compilar', () => {
    expect([...manifiesto.matchAll(/uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1])).toEqual([]);
  });

  it('la única entrada es abrir la app', () => {
    const acciones = [...manifiesto.matchAll(/<action android:name="([^"]+)"/g)].map((m) => m[1]);
    expect(acciones).toEqual(['android.intent.action.MAIN']);
    for (const c of manifiesto.match(/<!--[\s\S]*?-->/g) ?? []) expect(c.slice(4, -3)).not.toContain('--');
  });

  it('se adapta a cualquier pantalla (ADR-016): redimensionable, sin orientación fija, todas las densidades', () => {
    expect(manifiesto).toContain('android:resizeableActivity="true"');
    expect(manifiesto).not.toContain('screenOrientation');
    for (const t of ['smallScreens', 'normalScreens', 'largeScreens', 'xlargeScreens', 'anyDensity']) {
      expect(manifiesto).toContain(`android:${t}="true"`);
    }
  });
});
