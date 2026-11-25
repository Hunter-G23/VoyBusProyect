const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 1000 } });
    const errors = [];
    const network = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', req => { if (/^https?:/.test(req.url())) network.push(req.url()); });
    await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
    const devices = page.locator('.device');
    for (const device of await devices.all()) {
      assert.equal(await device.locator('nav button').count(), 4);
      const trip = device.getByRole('button', { name: 'Mi viaje', exact: true });
      await trip.click();
      assert(await device.locator('.trip-note').isVisible());
      const active = device.locator('[aria-current="page"]');
      await active.click();
      assert.equal(await device.locator('.trip-note').textContent(), '');
      const bounds = await device.boundingBox();
      assert.equal(bounds.width, 360);
      assert.equal(bounds.height, 780);
      assert(bounds.y + bounds.height <= 1000);
    }
    assert.equal(await devices.first().locator('.line-row').count(), 5);
    await page.screenshot({ path: path.join(__dirname, 'preview.png') });
    const catalog = devices.first();
    const map = devices.last();
    await catalog.getByRole('button', { name: 'Activas', exact: true }).click();
    assert.equal(await catalog.locator('.line-row').count(), 3);
    await catalog.getByRole('button', { name: 'Todas', exact: true }).click();
    const search = catalog.getByRole('searchbox');
    await search.fill('huascar');
    assert.equal(await catalog.locator('.line-row').count(), 3);
    await search.fill('E01');
    assert.equal(await catalog.locator('.line-row').count(), 1);
    await catalog.locator('[data-star="E01"]').click();
    await catalog.getByRole('button', { name: 'Favoritas', exact: true }).click();
    assert.equal(await catalog.locator('.line-row').count(), 1);
    await map.getByRole('button', { name: 'Bus simulado de la línea E01' }).click();
    assert.equal(await map.locator('.sheet-line').textContent(), 'E01');
    assert.equal(await map.locator('.star').getAttribute('aria-pressed'), 'true');
    await map.getByRole('searchbox').fill('Oficina');
    await map.locator('[data-result="107"]').click();
    assert.equal(await map.locator('.sheet-line').textContent(), '107');
    await page.setViewportSize({ width: 375, height: 900 });
    await page.reload();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const device of await devices.all()) {
      assert.equal(await device.locator('nav button').count(), 4);
      const trip = device.getByRole('button', { name: 'Mi viaje', exact: true });
      await trip.click();
      assert(await device.locator('.trip-note').isVisible());
      const active = device.locator('[aria-current="page"]');
      await active.click();
      assert.equal(await device.locator('.trip-note').textContent(), '');
      const bounds = await device.boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= 375);
    }
    await page.screenshot({ path: path.join(__dirname, 'preview-mobile.png') });
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    console.log('OK · desktop 1120×1000, mobile 375×900. Filtros, búsqueda, favoritos, marcadores, destinos y ausencia de peticiones externas.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });


