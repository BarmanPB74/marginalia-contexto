import { describe, expect, it } from 'vitest';
import tokensCss from '../../src/ui/tokens.css?raw';

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

function token(nombre: string, css = tokensCss): string {
  const coincidencia = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(css);
  if (!coincidencia?.[1]) throw new Error(`Falta el token --${nombre}`);
  return coincidencia[1].trim();
}

// Luminancia relativa y contraste según WCAG 2.x.
function luminancia(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

const TEMAS = [
  ['claro', tokensCss],
  ['oscuro', bloqueOscuro],
] as const;

describe('tokens de diseño', () => {
  it('define todos los tokens de DISENO.md', () => {
    for (const nombre of ['papel', 'papel-2', 'tinta', 'tinta-suave', 'acento', 'marca', 'trazo', 'radio']) {
      expect(token(nombre)).not.toBe('');
    }
  });

  it.each(TEMAS)('tema %s: tinta y acento sobre papel tienen contraste ≥ 7:1 (AAA)', (_, css) => {
    expect(contraste(token('tinta', css), token('papel', css))).toBeGreaterThanOrEqual(7);
    expect(contraste(token('tinta', css), token('papel-2', css))).toBeGreaterThanOrEqual(7);
    expect(contraste(token('tinta', css), token('superficie', css))).toBeGreaterThanOrEqual(7);
    expect(contraste(token('acento', css), token('papel', css))).toBeGreaterThanOrEqual(7);
  });

  it.each(TEMAS)('tema %s: la tinta suave (texto secundario) llega al menos a 4.5:1 (AA)', (_, css) => {
    expect(contraste(token('tinta-suave', css), token('papel', css))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(token('tinta-suave', css), token('papel-2', css))).toBeGreaterThanOrEqual(4.5);
  });

  it('el oscuro del teléfono y el fijado en Ajustes son idénticos', () => {
    const limpiar = (css: string) => css.replace(/\s+/g, ' ').replace(/color-scheme: dark;/, '').trim();
    expect(bloqueOscuro).not.toBe('');
    expect(limpiar(bloqueOscuroSistema)).toBe(limpiar(bloqueOscuro));
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
