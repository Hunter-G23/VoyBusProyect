import { test, expect } from '@playwright/test';
import { login } from './helpers';
test('administrator confirms status changes and sees the audit actor', async ({ page }) => {
  await page.goto('/'); await login(page, 'admin@example.test');
  await page.getByRole('button', { name: 'Estado de líneas', exact: true }).click();
  const line = page.getByTestId('admin-line-129');
  await line.getByRole('radio', { name: 'Temporalmente inactiva', exact: true }).click();
  await line.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
  await expect(line.getByRole('button', { name: 'Confirmar cambio', exact: true })).toBeVisible();
  await line.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
  await expect(line.getByText(/Último cambio:/)).toBeVisible();
  await expect(line.getByText('Temporalmente inactiva', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('tab', { name: 'Líneas', exact: true }).click();
  await page.getByRole('radio', { name: 'Temporalmente inactivas', exact: true }).click();
  await expect(page.getByRole('button', { name: /^129,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Estado de líneas', exact: true }).click();
  const restored = page.getByTestId('admin-line-129');
  await restored.getByRole('radio', { name: 'Automático', exact: true }).click();
  await restored.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
  await restored.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
  await expect(restored.getByText('Estado guardado.', { exact: true })).toBeVisible();
  await expect(restored.getByRole('button', { name: 'Cambiar estado', exact: true })).toBeDisabled();
  await expect(restored.getByRole('radio', { name: 'Automático', exact: true })).toBeChecked();
  // Back in automatic mode the simulated buses make the line active again.
  await expect(restored.getByText('Activa', { exact: true })).toHaveCount(2);
  await expect(restored.getByText('No activa', { exact: true })).toHaveCount(1);
});
