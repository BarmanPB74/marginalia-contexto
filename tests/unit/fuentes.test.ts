import { describe, expect, it } from 'vitest';
import fuentesCss from '../../src/ui/fuentes.css?raw';
import tokensCss from '../../src/ui/tokens.css?raw';

const archivos = Object.keys(import.meta.glob('../../src/assets/fonts/**/*'));
const urls = [...fuentesCss.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1] ?? '');

describe('fuentes locales (combinación B)', () => {
  it('declara al menos una fuente y todas son archivos locales .woff2', () => {
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toMatch(/^(https?:)?\/\//);
      expect(url).toMatch(/\.woff2$/);
    }
  });

  it('cada archivo referenciado existe en src/assets/fonts', () => {
    for (const url of urls) {
      const ruta = '../../src/assets/fonts/' + url.replace(/^.*assets\/fonts\//, '');
      expect(archivos).toContain(ruta);
    }
  });

  it('cada familia empaquetada lleva su licencia OFL', () => {
    for (const familia of ['newsreader', 'kalam', 'jetbrains-mono']) {
      expect(archivos).toContain(`../../src/assets/fonts/${familia}/OFL.txt`);
    }
  });

  it('los tokens usan Newsreader para leer, Kalam a mano y JetBrains Mono para código', () => {
    expect(tokensCss).toMatch(/--letra-cuerpo:\s*'Newsreader'/);
    expect(tokensCss).toMatch(/--letra-mano:\s*'Kalam'/);
    expect(tokensCss).toMatch(/--letra-codigo:\s*'JetBrains Mono'/);
  });
});
