/*
 * Disposición adaptable (docs/DISENO.md § Tamaños de pantalla): la galería (#/galeria) en teléfonos
 * pequeños y grandes, plegable, tableta vertical y horizontal. En cada tamaño:
 * - no hay scroll horizontal de página;
 * - compacto (< 600 px) → barra inferior; ≥ 600 px → riel lateral a la izquierda;
 * - todo botón visible mide al menos 44 × 44 px (la meta del diseño es 48).
 * Deja capturas en capturas/diseno/ (carpeta ignorada por git) para revisarlas a ojo.
 */
import { expect, test, type Page } from '@playwright/test';

const TAMANOS = [
  { nombre: 'telefono-pequeno', width: 320, height: 640 },
  { nombre: 'telefono', width: 360, height: 800 },
  { nombre: 'telefono-grande', width: 412, height: 915 },
  { nombre: 'plegable', width: 600, height: 960 },
  { nombre: 'tableta-vertical', width: 800, height: 1280 },
  { nombre: 'tableta-horizontal', width: 1280, height: 800 },
] as const;

const CARPETA = 'capturas/diseno';

async function abrirGaleria(page: Page) {
  await page.goto('/#/galeria');
  await expect(page.getByRole('heading', { level: 1, name: 'Galería' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Medir con las animaciones de entrada ya terminadas
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)),
  );
}

const desbordeHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Botones (y enlaces de navegación, casillas, manijas) visibles con una caja menor de 44 px. */
const objetivosPequenos = (page: Page) =>
  page.evaluate(() => {
    const visible = (el: Element) => {
      const caja = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      return caja.width > 0 && caja.height > 0 && estilo.visibility !== 'hidden' && el.checkVisibility();
    };
    const objetivos = [
      ...document.querySelectorAll('button, .barra-inferior a, input[type="range"]'),
      // Las casillas se tocan por su etiqueta entera (el input nativo es transparente)
      ...[...document.querySelectorAll('input[type="checkbox"]')].map((i) => i.closest('label') ?? i),
    ]
      // Enlaces estirados: el nombre cubre toda la tarjeta o la fila (::after), que es lo que se toca
      .map((el) => el.closest('.tarjeta-producto, .tabla__fila--tocable') ?? el)
      // Excepción documentada (DISENO.md): un mes de 7 columnas en 320 px deja celdas de ~41 × 48 px
      .filter((el) => !(el.classList.contains('celda-dia') && innerWidth < 360 && el.getBoundingClientRect().width >= 40));
    return objetivos
      .filter(visible)
      .map((el) => ({
        texto: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.tagName,
        caja: el.getBoundingClientRect(),
      }))
      .filter(({ caja }) => caja.width < 44 || caja.height < 44)
      .map(({ texto, caja }) => `${texto}: ${Math.round(caja.width)}×${Math.round(caja.height)}`);
  });

for (const t of TAMANOS) {
  test.describe(`${t.nombre} ${t.width}×${t.height}`, () => {
    test.use({ viewport: { width: t.width, height: t.height } });

    test('sin scroll horizontal, navegación correcta y objetivos ≥ 44 px', async ({ page }) => {
      await abrirGaleria(page);

      expect(await desbordeHorizontal(page)).toBe(0);

      const nav = page.getByRole('navigation', { name: 'Secciones' });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link')).toHaveCount(5);
      const caja = await nav.boundingBox();
      if (!caja) throw new Error('sin caja de la navegación');
      if (t.width < 600) {
        // Barra inferior: todo el ancho, pegada abajo
        expect(Math.round(caja.width)).toBe(t.width);
        expect(Math.round(caja.y + caja.height)).toBe(t.height);
        expect(caja.height).toBeLessThan(140);
      } else {
        // Riel lateral: a la izquierda, de arriba abajo, estrecho
        expect(caja.x).toBe(0);
        expect(Math.round(caja.height)).toBe(t.height);
        expect(caja.width).toBeLessThan(160);
        // El contenido empieza a la derecha del riel
        const titulo = await page.getByRole('heading', { level: 1, name: 'Galería' }).boundingBox();
        expect(titulo?.x ?? 0).toBeGreaterThanOrEqual(caja.width);
      }

      // Panel de filtros: columna fija desde 840 px; antes, botón «Filtros (n)»
      const panel = page.getByRole('complementary', { name: 'Filtros' });
      const botonFiltros = page.getByRole('button', { name: /^Filtros \(\d+\)$/ });
      if (t.width >= 840) {
        await expect(panel).toBeVisible();
        await expect(botonFiltros).toBeHidden();
      } else {
        await expect(panel).toBeHidden();
        await expect(botonFiltros).toBeVisible();
      }

      // Rejilla de productos: 2 columnas en teléfonos, más en tabletas
      const columnas = await page.evaluate(() => {
        const rejilla = document.querySelector('.rejilla--producto');
        return rejilla ? getComputedStyle(rejilla).gridTemplateColumns.split(' ').length : 0;
      });
      expect(columnas).toBeGreaterThanOrEqual(t.width < 600 ? 2 : 3);

      expect(await objetivosPequenos(page)).toEqual([]);

      await page.screenshot({ path: `${CARPETA}/${t.width}x${t.height}-${t.nombre}.png` });
      await page.screenshot({ path: `${CARPETA}/${t.width}x${t.height}-${t.nombre}-completa.png`, fullPage: true });
    });
  });
}

test.describe('compacto: filtros en hoja inferior', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('«Filtros (n)» abre la hoja con los filtros y Escape la cierra', async ({ page }) => {
    await abrirGaleria(page);
    await page.getByRole('button', { name: /^Filtros \(\d+\)$/ }).click();
    const hoja = page.getByRole('dialog', { name: 'Filtros' });
    await expect(hoja).toBeVisible();
    await expect(hoja.getByRole('group', { name: 'Precio' })).toBeVisible();
    await expect(hoja.getByRole('checkbox', { name: /Calientes/ })).toBeChecked();
    expect(await desbordeHorizontal(page)).toBe(0);
    await page.screenshot({ path: `${CARPETA}/360x800-hoja-filtros.png` });
    await page.keyboard.press('Escape');
    await expect(hoja).toBeHidden();
  });
});

test.describe('letra del sistema al 200 %', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('con el texto al doble no aparece scroll horizontal', async ({ page }) => {
    await abrirGaleria(page);
    // La WebView aplica textZoom; aquí se simula doblando el tamaño raíz (todo el texto va en rem)
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await page.evaluate(() => document.fonts.ready);
    expect(await desbordeHorizontal(page)).toBe(0);
    await page.screenshot({ path: `${CARPETA}/360x800-texto-200.png` });
    await page.screenshot({ path: `${CARPETA}/360x800-texto-200-completa.png`, fullPage: true });
  });
});

test.describe('tema oscuro', () => {
  test.use({ viewport: { width: 412, height: 915 }, colorScheme: 'dark' });

  test('la galería en oscuro (captura)', async ({ page }) => {
    await abrirGaleria(page);
    expect(await desbordeHorizontal(page)).toBe(0);
    await page.screenshot({ path: `${CARPETA}/412x915-oscuro.png` });
  });
});

test.describe('tableta horizontal en oscuro', () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });

  test('captura', async ({ page }) => {
    await abrirGaleria(page);
    await page.screenshot({ path: `${CARPETA}/1280x800-oscuro.png` });
  });
});
