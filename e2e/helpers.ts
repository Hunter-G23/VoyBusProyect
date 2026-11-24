import { expect, type Page } from '@playwright/test';
export async function login(page: Page, email = 'pasajero@example.test', password = 'VoyBusDemo2026!') {
  await page.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const response = page.waitForResponse(response => response.url().endsWith('/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).last().click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('button', { name: /^Perfil:/ })).toBeVisible();
}
