import { expect, test } from '@playwright/test';

// En el APK, Capacitor 8 dibuja la app bajo la barra de estado y la de gestos, e inyecta sus medidas
// como --safe-area-inset-*. Aquí se simula lo mismo: 32 px arriba (estado) y 24 px abajo (gestos).
const ARRIBA = 32;
const ABAJO = 24;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([arriba, abajo]) => {
      // Al correr el script de inicio aún no existe <html>: se inyecta al cargar, como hace Capacitor.
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.setProperty('--safe-area-inset-top', `${arriba}px`);
        document.documentElement.style.setProperty('--safe-area-inset-bottom', `${abajo}px`);
      });
    },
    [ARRIBA, ABAJO],
  );
});

for (const ruta of ['#/notas', '#/calendario', '#/musica', '#/ajustes']) {
  test(`${ruta}: el título no queda bajo la barra de estado`, async ({ page }) => {
    await page.goto(`/${ruta}`);
    const titulo = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(titulo?.y).toBeGreaterThanOrEqual(ARRIBA);
  });
}

test('una nota abierta: la ruta, volver y el título quedan bajo la barra de estado', async ({ page }) => {
  await page.goto('/#/notas');
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByRole('button', { name: 'En blanco' }).click();
  for (const caja of [
    await page.getByRole('button', { name: 'Volver' }).boundingBox(),
    await page.getByLabel('Título').boundingBox(),
  ]) {
    expect(caja?.y).toBeGreaterThanOrEqual(ARRIBA);
  }
});

test('la barra inferior deja libre la zona de gestos', async ({ page }) => {
  await page.goto('/#/notas');
  const enlace = await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link').first().boundingBox();
  const alto = page.viewportSize()?.height ?? 0;
  expect((enlace?.y ?? 0) + (enlace?.height ?? 0)).toBeLessThanOrEqual(alto - ABAJO);
});
