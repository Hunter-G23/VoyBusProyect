import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { login } from './helpers';

async function targets(page: Page) {
  await expect.poll(async () => page.locator('button,[role="button"],[role="tab"],[role="radio"],a,input,select,textarea').evaluateAll(elements => elements.flatMap(element => {
    const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
    if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return [];
    return rect.width >= 47.9 && rect.height >= 47.9 ? [] : [{ label: element.getAttribute('aria-label') ?? element.textContent, width: rect.width, height: rect.height }];
  }))).toEqual([]);
}
async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ width: 195, scroll: 195 });
}

test('390px controls have 48px targets across passenger forms and screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Líneas', exact: true })).toBeVisible(); await targets(page);
  await page.getByRole('button', { name: /^102,/ }).click(); await page.getByRole('radio').first().click();
  await expect(page.getByTestId('ordered-stops')).toBeVisible(); await targets(page);
  await page.getByRole('tab', { name: 'Mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar paradero', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Nombre o código del paradero' })).toBeVisible(); await targets(page);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Posiciones por micro', exact: true })).toBeVisible(); await targets(page);
  await page.getByRole('tab', { name: 'Favoritos', exact: true }).click(); await targets(page);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).first().click(); await targets(page);
  await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click(); await targets(page);
  await page.getByRole('button', { name: 'Volver', exact: true }).click(); await login(page);
  await page.getByRole('tab', { name: 'Mi viaje', exact: true }).click();
  await expect(page.getByRole('radiogroup').or(page.getByLabel('Código del vehículo', { exact: true }))).toBeVisible();
  const code = page.getByLabel('Código del vehículo', { exact: true });
  if (await code.isVisible()) { await code.fill('BUS001'); await page.getByRole('button', { name: 'Vincular vehículo', exact: true }).click(); }
  await expect(page.getByRole('radiogroup')).toBeVisible(); await targets(page);
  await page.getByRole('button', { name: /^Perfil:/ }).click(); await targets(page);
  for (const section of ['Mi perfil', 'Preferencias', 'Seguridad']) { await page.getByRole('button', { name: section, exact: true }).click(); await targets(page); }
});

test('195px layout has no horizontal overflow in Lines, My trip and Profile', async ({ page }, info) => {
  await page.setViewportSize({ width: 195, height: 844 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Líneas', exact: true })).toBeVisible(); await noOverflow(page);
  await page.screenshot({ path: info.outputPath('lines-195.png'), fullPage: true });
  await login(page); await page.getByRole('tab', { name: 'Mi viaje', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi viaje', exact: true })).toBeVisible(); await noOverflow(page);
  await page.screenshot({ path: info.outputPath('trip-195.png'), fullPage: true });
  await page.getByRole('button', { name: /^Perfil:/ }).click(); await noOverflow(page);
  await page.getByRole('button', { name: 'Preferencias', exact: true }).click(); await noOverflow(page);
  await page.screenshot({ path: info.outputPath('profile-195.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('radio', { name: 'Oscuro', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Oscuro', exact: true })).toBeChecked();
  await page.screenshot({ path: info.outputPath('profile-dark-390.png'), fullPage: true });
});

test('keyboard focus is visible and reduced motion preserves navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Líneas', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => { const style = getComputedStyle(document.activeElement!); return style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 3; })).toBe(true);
  // First stop is the settings gear; the next one is Ingresar.
  await expect(page.getByRole('button', { name: 'Ajustes', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: /^102,/ }).click(); await page.getByRole('radio').first().click();
  await expect(page.getByTestId('ordered-stops')).toBeVisible();
  await page.getByRole('button', { name: 'Ir a mi viaje', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ingresar o crear cuenta', exact: true })).toBeVisible();
});

test('driver and administrator controls meet 48px targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await login(page, 'conductor@example.test');
  await expect(page.getByRole('heading', { name: 'Solicitudes de parada', exact: true })).toBeVisible(); await targets(page);
  await page.getByRole('button', { name: /^Perfil:/ }).click(); await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await login(page, 'admin@example.test'); await page.getByRole('button', { name: 'Estado de líneas', exact: true }).click();
  await expect(page.getByTestId('admin-line-102')).toBeVisible(); await targets(page);
});

test('invalid login alert uses the error text color in light and dark themes', async ({ page }) => {
  for (const [colorScheme, color] of [['light', 'rgb(155, 44, 44)'], ['dark', 'rgb(242, 160, 160)']] as const) {
    await test.step(colorScheme, async () => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
      await page.getByLabel('Correo electrónico', { exact: true }).fill('pasajero@example.test');
      await page.getByLabel('Contraseña', { exact: true }).fill('Incorrecta2026!');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).last().click();
      const message = page.getByRole('alert').getByText('Correo o contraseña incorrectos.', { exact: true });
      await expect(message).toHaveCSS('color', color);
    });
  }
});

function ratio(a: string, b: string) {
  const luminance = (hex: string) => { const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4); return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722; };
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05);
}
test('light and dark token pairs meet text and control contrast thresholds', () => {
  const source = readFileSync('front/src/theme.tsx', 'utf8');
  for (const name of ['light', 'dark']) {
    const body = source.match(new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\}`))![1];
    const tokens = Object.fromEntries([...body.matchAll(/(\w+): "(#[0-9a-fA-F]{6})"/g)].map(match => [match[1], match[2]]));
    for (const [foreground, background] of [['ink', 'background'], ['muted', 'paper'], ['muted', 'background'], ['muted', 'surface'], ['action', 'paper'], ['onAction', 'action'], ['onAction', 'actionPressed'], ['error', 'paper'], ['signalInk', 'signal'], ['onPlate', 'plate'], ['plateMuted', 'plate']]) expect(ratio(tokens[foreground], tokens[background]), `${name}: ${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
    for (const background of ['paper', 'background']) expect(ratio(tokens.border, tokens[background])).toBeGreaterThanOrEqual(3);
  }
});
