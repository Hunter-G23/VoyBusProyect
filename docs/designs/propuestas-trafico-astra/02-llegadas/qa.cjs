const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1120,height:1000},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    const url=pathToFileURL(path.join(__dirname,'index.html')).href;
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);
    const [a,b]=await page.locator('.phone').all();
    for(const p of [a,b]){
      const bounds=await p.boundingBox();
      assert.equal(bounds.width,360);assert.equal(bounds.height,780);assert(bounds.y+bounds.height<=1000);
      assert.equal(await p.locator('[data-bus]').count(),52);
      assert.equal(await p.locator('nav button').count(),4);
    }
    await page.screenshot({path:path.join(__dirname,'preview.png')});
    assert.equal(await a.locator('[data-trace]').getAttribute('data-trace'),'102');
    assert.equal(await b.locator('[data-trace]').count(),0);
    await b.locator('[data-line="102"]').click();
    assert.equal(await b.locator('[data-trace]').getAttribute('stroke'),'#005BAA');
    await b.locator('[data-line="E01"]').click();
    assert.equal(await b.locator('[data-trace]').getAttribute('stroke'),'#598200');
    await b.getByRole('button',{name:'Quitar recorrido'}).click();
    assert.equal(await b.locator('[data-trace]').count(),0);
    await b.getByRole('button',{name:'Buscar paradero',exact:true}).click();
    await b.getByRole('searchbox').fill('colon');
    await b.locator('.options [data-stop="1"]').click();
    assert.equal(await b.locator('.station-name').textContent(),'Plaza Colón');
    assert.deepEqual(await b.locator('.arrival .eta').allTextContents(),['2min aprox.','5min aprox.','8min aprox.']);
    const bus=await b.locator('[data-bus="1"] .micro').boundingBox();
    await page.mouse.click(bus.x+bus.width/2,bus.y+bus.height/2);
    assert.match(await b.locator('.route-card').innerText(),/Micro 1 · Línea 102/);
    await b.getByRole('button',{name:'Favoritos',exact:true}).click();
    await b.locator('[data-save]').click();
    await b.locator('.subpage [data-stop="1"]').click();
    await b.getByRole('button',{name:'Mi viaje',exact:true}).click();
    await b.locator('.cta').click();await b.locator('.options [data-stop="0"]').click();
    await b.getByRole('button',{name:'Líneas',exact:true}).click();
    assert.equal(await b.locator('.catalog .item').count(),13);
    await page.setViewportSize({width:375,height:900});await page.goto(url);await page.evaluate(()=>document.fonts.ready);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await a.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
    await page.screenshot({path:path.join(__dirname,'preview-mobile.png')});
    assert.deepEqual(errors,[]);
    console.log('Chrome: desk, mobile, 13 lines, 52 vehicles, stops, 3/6/9 and 2/5/8 min, individual route, clear and tabs passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
