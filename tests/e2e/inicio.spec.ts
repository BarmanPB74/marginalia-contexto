import { expect, test } from '@playwright/test';

test('la pantalla de papel muestra el nombre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Marginalia' })).toBeVisible();
});
