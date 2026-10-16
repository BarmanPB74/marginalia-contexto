import { describe, expect, it } from 'vitest';
import tokensCss from '../../src/ui/tokens.css?raw';
import { CATEGORIAS } from '../../src/ui/categorias';

// Todo el código fuente como texto, para buscar colores sueltos.
const fuentes = import.meta.glob<string>('../../src/**/*.{css,ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Bloque del tema oscuro fijado en Ajustes (el de la media query repite los mismos valores). */
const bloqueOscuro = /:root\[data-tema='oscuro'\]\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';
const bloqueOscuroSistema =
  /prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-tema='claro'\]\)\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';
/** Bloque :root principal (tema claro y medidas) */
const bloqueClaro = /^:root\s*\{([^}]*)\}/m.exec(tokensCss)?.[1] ?? '';

function token(nombre: string, css = bloqueClaro): string {
  const coincidencia = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(css);
  if (!coincidencia?.[1]) throw new Error(`Falta el token --${nombre}`);
  return coincidencia[1].trim();
}

/** Color hexadecimal de 6 cifras (los tokens de color que llevan texto lo son siempre). */
function hex(nombre: string, css: string): string {
  const valor = token(nombre, css);
  if (!/^#[0-9a-f]{6}$/i.test(valor)) throw new Error(`--${nombre} debe ser #rrggbb, es ${valor}`);
  return valor;
}

// Luminancia relativa y contraste según WCAG 2.x.
function luminancia(color: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const canal = parseInt(color.slice(i, i + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

const TEMAS = [
  ['claro', bloqueClaro],
  ['oscuro', bloqueOscuro],
] as const;

/** Superficies sobre las que se escribe texto */
const FONDOS = ['fondo', 'superficie', 'superficie-alta', 'hundido'];
const ESTADOS = ['exito', 'aviso', 'peligro', 'info'];

describe('tokens de diseño', () => {
  it('define los tokens nuevos y los alias de Marginalia', () => {
    for (const nombre of [
      ...FONDOS,
      'texto',
      'texto-2',
      'primario',
      'sobre-primario',
      'primario-tinta',
      'primario-suave',
      'sombra',
      'sombra-s',
      'sombra-hundida',
      'radio',
      'radio-l',
      'esp-1',
      'esp-4',
      'texto-m',
      'toque',
      'ancho-riel',
      // alias que siguen usando las pantallas de la Bitácora
      'papel',
      'papel-2',
      'tinta',
      'tinta-suave',
      'acento',
      'acento-suave',
      'marca',
      'trazo',
      'letra-mano',
      'letra-cuerpo',
    ]) {
      expect(token(nombre)).not.toBe('');
    }
  });

  it('los alias viejos apuntan a los tokens nuevos (no duplican colores)', () => {
    expect(token('papel')).toBe('var(--fondo)');
    expect(token('tinta')).toBe('var(--texto)');
    expect(token('tinta-suave')).toBe('var(--texto-2)');
    expect(token('acento')).toBe('var(--primario-tinta)');
  });

  it.each(TEMAS)('tema %s: el texto principal llega a 7:1 (AAA) sobre todas las superficies', (_, css) => {
    for (const fondo of FONDOS) {
      expect(contraste(hex('texto', css), hex(fondo, css)), `texto/${fondo}`).toBeGreaterThanOrEqual(7);
    }
  });

  it.each(TEMAS)('tema %s: texto secundario y enlaces (primario-tinta) ≥ 4.5:1 (AA) en todas las superficies', (_, css) => {
    for (const fondo of [...FONDOS, 'primario-suave']) {
      if (fondo !== 'primario-suave') {
        expect(contraste(hex('texto-2', css), hex(fondo, css)), `texto-2/${fondo}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(hex('primario-tinta', css), hex(fondo, css)), `primario-tinta/${fondo}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(TEMAS)('tema %s: el texto sobre el botón primario y el de peligro ≥ 4.5:1', (_, css) => {
    expect(contraste(hex('sobre-primario', css), hex('primario', css))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(hex('sobre-primario', css), hex('primario-fuerte', css))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(hex('sobre-peligro', css), hex('peligro-solido', css))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TEMAS)('tema %s: cada tinta de categoría y de estado ≥ 4.5:1 sobre su suave y sobre las superficies', (_, css) => {
    const pares = [...CATEGORIAS.map((c) => `cat-${c}`), ...ESTADOS];
    for (const p of pares) {
      for (const fondo of [`${p}-suave`, ...FONDOS]) {
        expect(contraste(hex(`${p}-tinta`, css), hex(fondo, css)), `${p}-tinta/${fondo}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(TEMAS)('tema %s: el primario se distingue del fondo como objeto gráfico (≥ 3:1)', (_, css) => {
    for (const fondo of FONDOS) {
      expect(contraste(hex('primario', css), hex(fondo, css)), `primario/${fondo}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('el oscuro del teléfono y el fijado en Ajustes son idénticos', () => {
    const limpiar = (css: string) => css.replace(/\s+/g, ' ').replace(/color-scheme: dark;/, '').trim();
    expect(bloqueOscuro).not.toBe('');
    expect(limpiar(bloqueOscuroSistema)).toBe(limpiar(bloqueOscuro));
  });

  it('el tema oscuro redefine todos los colores del claro', () => {
    const colores = [...bloqueClaro.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8}|rgb\([^)]*\))\s*;/gi)].map((m) => m[1] ?? '');
    expect(colores.length).toBeGreaterThan(40);
    for (const nombre of colores) expect(() => token(nombre, bloqueOscuro), nombre).not.toThrow();
  });

  it('tipografía: el cuerpo nunca baja de 16 px y nada baja de 13 px', () => {
    const minimo = (nombre: string) => {
      const valor = token(nombre);
      const rem = /clamp\(\s*([\d.]+)rem/.exec(valor)?.[1];
      if (!rem) throw new Error(`--${nombre} debe ser clamp(<rem>, …)`);
      return Number(rem) * 16;
    };
    expect(minimo('texto-m')).toBeGreaterThanOrEqual(16);
    for (const t of ['texto-xs', 'texto-s', 'texto-m', 'texto-l', 'texto-xl', 'texto-cifra']) {
      expect(minimo(t), t).toBeGreaterThanOrEqual(13);
    }
  });

  it('objetivos táctiles de 48 px y movimiento que respeta «reducir movimiento»', () => {
    expect(token('toque')).toBe('48px');
    expect(tokensCss).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{[^}]*--dur-media:\s*0ms/);
  });

  it('no hay colores sueltos fuera de tokens.css', () => {
    const color = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;
    const infractores = Object.entries(fuentes)
      .filter(([ruta]) => !ruta.endsWith('/ui/tokens.css'))
      .filter(([, texto]) => color.test(texto))
      .map(([ruta]) => ruta);
    expect(infractores).toEqual([]);
  });
});
