const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1120,height:1000}});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  const light=page.locator('.device').first(),dark=page.locator('.device').last();
  assert.equal(await light.locator('[data-trace]').getAttribute('data-trace'),'102');
  assert.equal(await dark.locator('[data-trace]').count(),0);
  assert.equal(await dark.locator('.heading').textContent(),'Parque Brasil');
  assert.deepEqual(await dark.locator('.eta').allTextContents(),['≈ 3 min','≈ 6 min','≈ 9 min']);
  assert(!(await dark.locator('.sheet').textContent()).includes('undefined'));
  for(const phone of [light,dark]){
   assert.equal(await phone.locator('.bus-point').count(),52);
   assert.equal(await phone.locator('select option').count(),14);
   assert.equal(await phone.locator('nav button').count(),4);
   assert.deepEqual(await phone.boundingBox().then(({width,height})=>[width,height]),[360,780]);
   const bounds=await phone.boundingBox();assert(bounds.y+bounds.height<=1000);
   const point=await phone.locator('.bus-point').first().boundingBox();assert.equal(point.width,48);assert.equal(point.height,48);
  }
  await page.screenshot({path:path.join(__dirname,'preview.png'),animations:'disabled'});
  const positions=()=>light.locator('.bus-point').evaluateAll(nodes=>nodes.map(node=>node.style.left+','+node.style.top));
  const before=await positions();
  await light.getByRole('button',{name:'Reproducir simulación de los 52 buses'}).click();
  const after=await positions();
  assert.equal(after.filter((value,i)=>value!==before[i]).length,52);
  await light.getByRole('button',{name:'Pausar simulación de los 52 buses'}).click();
  await light.locator('button[data-line="E01"]').click();
  assert.equal(await light.locator('[data-trace]').getAttribute('stroke'),'#598200');
  await light.getByLabel('Elegir otra línea').selectOption('129');
  assert.equal(await light.locator('[data-trace]').getAttribute('stroke'),'#4E0963');
  await light.getByRole('button',{name:'Limpiar recorrido'}).click();
  assert.equal(await light.locator('[data-trace]').count(),0);assert.equal(await light.locator('.bus-point').count(),52);
  async function tapPoint(phone,selector){
    const pos=await phone.locator(selector).boundingBox();
    await page.mouse.click(pos.x+pos.width/2,pos.y+pos.height/2);
  }
  await tapPoint(dark,'[data-stop="CM-02"]');assert.equal(await dark.locator('.heading').textContent(),'Mercado Central');
  await tapPoint(dark,'[data-stop="PB-01"]');assert.equal(await dark.locator('.heading').textContent(),'Parque Brasil');
  await tapPoint(light,'[data-bus="B39"]');assert((await light.locator('.sheet').textContent()).includes('B39'));
  await light.getByLabel('Buscar paradero o línea').fill('universidad');
  await light.locator('[data-result-stop="UA-04"]').click();
  assert.equal(await light.locator('.heading').textContent(),'Universidad de Antofagasta');
  await light.getByRole('button',{name:'Cambiar tema'}).click();assert((await light.getAttribute('class')).includes('dark'));
  await light.locator('[data-tab="list"]').click();await light.locator('[data-favorite="E01"]').click();
  await light.locator('[data-tab="fav"]').click();assert.equal(await light.locator('.drawer .list-line').count(),1);
  await light.locator('[data-tab="trip"]').click();assert((await light.locator('.drawer').textContent()).includes('Mi viaje'));
  await page.setViewportSize({width:375,height:900});await page.reload();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await page.screenshot({path:path.join(__dirname,'preview-mobile.png'),animations:'disabled'});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('OK · 52 buses / 13 líneas, un recorrido, dos paraderos, búsqueda, ETA, tema, navegación y anchos.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

