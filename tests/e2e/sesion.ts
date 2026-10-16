import { expect, type Page } from '@playwright/test';

/** PIN de las pruebas (4 dígitos, como en la app). */
export const PIN = '1234';

export async function teclearPin(page: Page, pin = PIN) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}

/**
 * Abre `ruta` con una sesión lista: en el primer uso crea a la dueña «Pablo» con el PIN; si ya
 * existe (p. ej. tras recargar), escribe el PIN. Devuelve cuando se ve la navegación.
 */
export async function entrar(page: Page, ruta = '/#/inicio') {
  await page.goto(ruta);
  const bienvenida = page.getByRole('heading', { level: 1, name: 'Bienvenido' });
  const pin = page.getByRole('group', { name: 'Escribe tu PIN' });
  await expect(bienvenida.or(pin)).toBeVisible();
  if (await bienvenida.isVisible()) {
    await page.getByLabel('Tu nombre').fill('Pablo');
    await page.getByRole('button', { name: 'Seguir' }).click();
    await teclearPin(page);
    await teclearPin(page);
  } else {
    await teclearPin(page);
  }
  await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
}
