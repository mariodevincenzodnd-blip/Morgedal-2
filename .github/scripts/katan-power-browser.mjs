import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.MORGEDAL_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PERSISTENCE_BASE_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Only simulated local Drive may be used');
const out=process.env.VISUAL_OUT_DIR||'visual-report';await fs.mkdir(out,{recursive:true});
const fixture=process.env.KATAN_TEST_FIXTURE?JSON.parse(await fs.readFile(process.env.KATAN_TEST_FIXTURE,'utf8')):null;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const results=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  let remote=fixture?structuredClone(fixture):null,writes=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.addInitScript(()=>{const token=JSON.stringify({token:'katan-ui-test-only',expiresAt:Date.now()+3600000});sessionStorage.setItem('morgedal-google-token-v4-shared',token);sessionStorage.setItem('morgedal-google-token-v2',token);});
  await context.route('https://accounts.google.com/**',r=>r.abort());await context.route('https://apis.google.com/**',r=>r.abort());
  await context.route(base+'/Katan_Scheda_Interattiva.html',async route=>{
   const response=await route.fetch(),source=await response.text();
   const hook='window.__katanTest={state:()=>STATE,render:()=>renderPoteri(),master:on=>{markMasterUnlocked();setMasterEditorOn(on);renderAll();}}; ';
   const body=source.replace('document.addEventListener("DOMContentLoaded", initLock);',hook+'document.addEventListener("DOMContentLoaded", initLock);');
   assert.notEqual(body,source);await route.fulfill({response,body});
  });
  await context.route('**/assets/sheet-persistence.js*',async route=>{
   const response=await route.fetch(),body=(await response.text()).replace('const create = factory();','const originalCreate = factory(); const create = options => { root.__katanOptions=options; const engine=originalCreate(options); root.__katanEngine=engine; return engine; };');
   await route.fulfill({response,body});
  });
  await context.route('https://www.googleapis.com/**',async route=>{
   if(route.request().url().includes('/oauth2/v3/userinfo'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({email:'mariodevincenzodnd@gmail.com'})});
   if(route.request().method()==='PATCH'){remote=route.request().postDataJSON();writes++;}
   else if(!remote)remote=await page.evaluate(()=>window.__katanOptions.getState());
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(remote)});
  });
  const ready=()=>page.waitForFunction(()=>window.__katanEngine?.isReady()&&!document.getElementById('panels').inert&&!window.__katanEngine.isDirty());
  await page.goto(base+'/Katan_Scheda_Interattiva.html',{waitUntil:'domcontentloaded'});await ready();
  await page.locator('[data-tab="poteri"]').click();
  const initial=await page.evaluate(()=>JSON.stringify(window.__katanTest.state())),before=writes;
  assert.deepEqual(await page.locator('[data-power-section]>summary').allTextContents(),['TRUCCHETTI⌄','ABILITÀ⌄','PASSIVE⌄']);
  assert.equal(await page.locator('[data-power-section][open]').count(),0);
  await page.screenshot({path:out+'/katan-powers-closed-'+width+'.png',fullPage:true});
  const tricks=page.locator('[data-power-section="truccetti"]');await tricks.locator('>summary').click();
  const first=tricks.locator('.power-item').first();assert.equal(await first.locator('.power-full').isVisible(),false);
  assert.equal(writes,before,'Opening categories must not write to Drive');
  const respip=await first.locator('.power-compact [data-respip]').first().getAttribute('data-respip');
  const index=Number(respip.split('-')[0]);
  await first.locator('.power-compact [data-respip]').first().click();await ready();
  assert.equal(await tricks.getAttribute('open'),'');
  await first.locator('.power-toggle').click();
  assert.equal(await first.locator('.power-full').isVisible(),true);
  assert.equal(await first.locator('.power-full [data-respip]').first().getAttribute('aria-pressed'),'true');
  await first.locator('.power-full [data-respip]').first().click();await ready();
  assert.equal(await first.locator('.power-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await first.locator('.power-compact [data-respip]').first().getAttribute('aria-pressed'),'false');
  await first.locator('.power-toggle').click();await first.locator('.power-toggle').focus();await page.keyboard.press('Enter');
  assert.equal(await first.locator('.power-full').isVisible(),true);
  await tricks.locator('>summary').click();await tricks.locator('>summary').click();
  assert.equal(await first.locator('.power-full').isVisible(),true);
  const abilities=page.locator('[data-power-section="abilita"]');await abilities.locator('>summary').click();
  const linked=await page.evaluate(()=>[...document.querySelectorAll('[data-power-section="abilita"] .power-item')].map(el=>({name:el.__powerItem.nome,ids:[...el.querySelectorAll('.power-full [data-respip]')].map(p=>p.dataset.respip.split('-')[0])})));
  assert.ok(linked.filter(x=>x.ids.length).length>=5,'Ability trackers must be attached to their abilities');
  // Exercise every linked ability counter in both views, including legacy indices.
  const abilityPips=await abilities.locator('.power-compact [data-respip]').evaluateAll(els=>els.filter(el=>el.dataset.respip.endsWith('-0')).map(el=>el.dataset.respip));
  for(const id of abilityPips){
   const compact=abilities.locator('.power-compact [data-respip="'+id+'"]');
   const item=compact.locator('xpath=ancestor::*[@data-power-item]');
   const toggle=item.locator('.power-toggle');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
   const full=item.locator('.power-full [data-respip="'+id+'"]');
   const initialPressed=await compact.getAttribute('aria-pressed');
   await compact.click();await ready();assert.notEqual(await full.getAttribute('aria-pressed'),initialPressed);
   await full.click();await ready();assert.equal(await compact.getAttribute('aria-pressed'),initialPressed);
  }
  assert.equal(await page.locator('#panel-poteri>div').filter({hasText:'Utilizzi Limitati'}).count(),0);
  const superCard=abilities.locator('.power-item').filter({has:page.locator('.power-item-name',{hasText:'SUPERABILITÀ'})});
  if(await superCard.locator('.power-toggle').getAttribute('aria-expanded')!=='true')await superCard.locator('.power-toggle').click();assert.ok(await superCard.locator('.power-use-note').count());
  await page.screenshot({path:out+'/katan-powers-expanded-'+width+'.png',fullPage:true});
  await page.evaluate(()=>window.__katanTest.render());
  const noMutations=await page.evaluate(initial=>{const a=JSON.parse(initial),b=window.__katanTest.state();a.risorse.forEach((r,i)=>r.used=b.risorse[i].used);return JSON.stringify(a)===JSON.stringify(b);},initial);
  assert.ok(noMutations,'UI must not rewrite descriptions, counts or schema');
  assert.equal(await page.locator('[data-master-field]').count(),0,'Player must not receive Master inputs');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  const stateBefore=await page.evaluate(()=>JSON.stringify(window.__katanTest.state()));
  await page.evaluate(()=>window.__katanTest.master(true));
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__katanTest.state())),stateBefore);
  // Structural and rich-text controls retain their original listeners after being moved.
  const rich=first.locator('.power-full [data-rich-arr]').first();
  await rich.evaluate(el=>{el.insertAdjacentHTML('beforeend','<b> test interfaccia</b>');el.dispatchEvent(new Event('input',{bubbles:true}));});await ready();
  const name=first.locator('[data-master-field$="|nome"]');await name.fill('Recuperare Energie — test');await ready();
  assert.match(remote.truccetti[0].desc,/test interfaccia/);assert.equal(remote.truccetti[0].nome,'Recuperare Energie — test');
  // Reordering and creating content must not make sections or full text inaccessible.
  await first.locator('[data-master-down]').click();await ready();
  assert.equal(await tricks.locator('.power-item').nth(1).locator('.power-toggle').getAttribute('aria-expanded'),'true');
  await page.screenshot({path:out+'/katan-powers-master-'+width+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Master mobile overflow');
  await page.reload({waitUntil:'domcontentloaded'});await ready();await page.locator('[data-tab="poteri"]').click();
  if(await page.locator('[data-power-section="truccetti"]').getAttribute('open')===null)await page.locator('[data-power-section="truccetti"]>summary').click();
  assert.match(await page.locator('[data-rich-arr="truccetti-1"]').innerHTML(),/test interfaccia/);
  assert.equal(await page.evaluate(index=>window.__katanTest.state().risorse[index].used,index),0);
  assert.deepEqual(errors,[]);
  results.push({width,result:'PASS',writes,checks:'nested panels, mirrored pips, saved reload, open state, keyboard, Master edits/reorder, no render mutations, no overflow'});
  console.log('PASS Katan power interface '+width);await context.close();
 }
 await fs.writeFile(out+'/katan-power-report.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
