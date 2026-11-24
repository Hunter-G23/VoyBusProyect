import { test, expect } from '@playwright/test';
import { login } from './helpers';
test('trip steps expose number, name and state', async ({ page }, info) => {
  const email = `trip-${info.project.name}-${Date.now()}@example.test`;
  await page.request.post('http://localhost:3001/api/auth/registro', { data: { nombre: 'Pasajero Pasos', correo: email, contrasena: 'VoyBusDemo2026!', confirmacion: 'VoyBusDemo2026!' } });
  await page.goto('/'); await login(page, email);
  await page.getByRole('tab', { name: 'Mi viaje', exact: true }).click();
  await expect(page.getByLabel('Paso 1: Vincular, En curso', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Paso 2: Destino, Pendiente', { exact: true })).toBeVisible();
  await page.getByLabel('Código del vehículo').fill('BUS001');
  await page.getByRole('button', { name: 'Vincular vehículo', exact: true }).click();
  await expect(page.getByLabel('Paso 1: Vincular, Completado', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Paso 2: Destino, En curso', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeDisabled();
});
