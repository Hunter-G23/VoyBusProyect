const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1120,height:1000}, reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()); });
    const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const [map, catalog] = await page.locator('.screen').all();
    const layouts = await page.locator('.screen').evaluateAll(els => els.map(el => {
      const b = el.getBoundingClientRect();
      return {w:b.width,h:b.height,y:b.bottom};
    }));
    assert(layouts.every(b => b.w===360 && b.h===780 && b.y<=1000));
    await page.screenshot({path:path.join(__dirname,'preview.png')});
    assert.equal(await catalog.locator('.row').count(),5);
    await catalog.getByRole('button',{name:'En pausa',exact:true}).click();
    assert.deepEqual(await catalog.locator('.code').allTextContents(),['104']);
    await catalog.getByRole('button',{name:'Todas',exact:true}).click();
    await catalog.getByRole('searchbox').fill('huascar');
    assert.equal(await catalog.locator('.row').count(),3);
    await catalog.getByRole('searchbox').fill('');
    await catalog.locator('[data-star="103"]').click();
    await catalog.getByRole('button',{name:'Favoritos',exact:true}).click();
    assert.deepEqual(await catalog.locator('.code').allTextContents(),['103','E01']);
    await map.locator('[data-bus="102"]').first().click();
    assert.equal(await map.locator('.sheet-code').innerText(),'102');
    await catalog.locator('[data-route="103"]').click();
    assert.equal(await catalog.locator('.sheet-code').innerText(),'103');
    await catalog.getByRole('button',{name:'Mi viaje',exact:true}).click();
    await catalog.getByRole('button',{name:'Elegir línea'}).click();
    assert.equal(await catalog.locator('.row').count(),5);
    await page.setViewportSize({width:375,height:900});
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
    assert(await map.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
    await page.screenshot({path:path.join(__dirname,'preview-mobile.png')});
    assert.deepEqual(errors,[]);
    console.log('Desktop and mobile verified. Search, filters, favorites, tabs, bus selection and route details passed.');
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
