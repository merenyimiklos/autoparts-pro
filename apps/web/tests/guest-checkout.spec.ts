import { expect, test } from '@playwright/test';

test('guest can add a product, checkout, and track the order', async ({ page }) => {
  await page.goto('/products');
  const first = page.locator('article.card').first();
  await expect(first).toBeVisible();
  await first.locator('a').first().click();
  await page.getByRole('button', { name: 'Kosárba' }).click();
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Tovább a pénztárhoz' }).click();
  await page.getByPlaceholder('E-mail').fill('guest@example.test');
  await page.getByPlaceholder('Átvevő neve').fill('Vendég Vásárló');
  await page.getByPlaceholder('Irányítószám').fill('1111');
  await page.getByPlaceholder('Város').fill('Budapest');
  await page.getByPlaceholder('Utca, házszám').fill('Vendég utca 1.');
  await page.getByRole('button', { name: 'Rendelés leadása' }).click();
  const success = page.getByText(/Sikeres rendelés: AP-/);
  await expect(success).toBeVisible();
  const orderNumber = (await success.textContent())!.split(': ')[1];
  const tracked = await page.request.get(`http://localhost:4000/api/orders/track/${orderNumber}?email=guest%40example.test`);
  expect(tracked.ok()).toBeTruthy();
  expect((await tracked.json()).orderNumber).toBe(orderNumber);
});
