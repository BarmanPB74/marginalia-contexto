import { describe, expect, it } from 'vitest';
import fuentesCss from '../../src/ui/fuentes.css?raw';
import tokensCss from '../../src/ui/tokens.css?raw';

const archivos = Object.keys(import.meta.glob('../../src/assets/fonts/**/*'));
const urls = [...fuentesCss.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1] ?? '');
const fuentesCodigo = import.meta.glob<string>('../../src/**/*.{css,ts,tsx}', { query: '?raw', import: 'default', eager: true });

describe('fuentes locales (Bar Box: Inter + JetBrains Mono)', () => {
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

  it('no queda ningún archivo de fuente sin usar (solo se empaqueta lo que se declara)', () => {
    const woff = archivos.filter((a) => a.endsWith('.woff2')).map((a) => a.replace(/^.*\/fonts\//, ''));
    const declarados = urls.map((u) => u.replace(/^.*assets\/fonts\//, ''));
    expect(woff.sort()).toEqual([...new Set(declarados)].sort());
  });

  it('cada familia empaquetada lleva su licencia OFL', () => {
    const familias = new Set(archivos.map((a) => a.replace(/^.*\/fonts\/([^/]+)\/.*$/, '$1')));
    expect([...familias].sort()).toEqual(['inter', 'jetbrains-mono']);
    for (const familia of familias) {
      expect(archivos).toContain(`../../src/assets/fonts/${familia}/OFL.txt`);
    }
  });

  it('Inter es variable (pesos 100–900) con latin y latin-ext', () => {
    expect(fuentesCss).toMatch(/font-weight:\s*100 900/);
    expect(urls.some((u) => u.includes('inter-latin-wght'))).toBe(true);
    expect(urls.some((u) => u.includes('inter-latin-ext-wght'))).toBe(true);
  });

  it('los tokens usan Inter para la interfaz y JetBrains Mono para código; la Bitácora hereda los alias', () => {
    expect(tokensCss).toMatch(/--letra-interfaz:\s*'Inter Variable'/);
    expect(tokensCss).toMatch(/--letra-cuerpo:\s*var\(--letra-interfaz\)/);
    expect(tokensCss).toMatch(/--letra-mano:\s*var\(--letra-interfaz\)/);
    expect(tokensCss).toMatch(/--letra-codigo:\s*'JetBrains Mono'/);
  });

  it('ningún estilo pide ya Newsreader ni Kalam (se quitaron)', () => {
    const usos = Object.entries(fuentesCodigo)
      .filter(([, texto]) => /['"](Newsreader|Kalam)['"]|fonts\/(newsreader|kalam)/.test(texto))
      .map(([ruta]) => ruta);
    expect(usos).toEqual([]);
  });
});
