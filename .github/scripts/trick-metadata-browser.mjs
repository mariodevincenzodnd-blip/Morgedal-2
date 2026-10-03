import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.MORGEDAL_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PERSISTENCE_BASE_URL||'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Tests must never write real Drive data');
const out=process.env.VISUAL_OUT_DIR||'visual-report';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report=[];
try{
  const files=(await fs.readdir('.')).filter(f=>f.endsWith('_Scheda_Interattiva.html')&&!f.includes('_QA_')).sort();
  for(const file of files){
    for(const width of [1440,390]){
      const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
      let remote=null,writes=0;
      page.on('pageerror',e=>errors.push(e.message));
      await context.addInitScript(()=>{
        const token=JSON.stringify({token:'tricks-test-fake',expiresAt:Date.now()+3600000});
        sessionStorage.setItem('morgedal-google-token-v4-shared',token);
        sessionStorage.setItem('morgedal-google-token-v2',token);
      });
      await context.route('https://accounts.google.com/**',r=>r.abort());
      await context.route('https://apis.google.com/**',r=>r.abort());
      await context.route(base+'/'+file,async route=>{
        const response=await route.fetch();const source=await response.text();
        const body=source.replace(/document.addEventListener\("DOMContentLoaded", (?=initLock|\(\)=>)/,
          'window.__tricksTest={getState:()=>STATE,render:()=>renderPoteri(),master:()=>{markMasterUnlocked();setMasterEditorOn(true);renderPoteri();}}; $&');
        assert.notEqual(body,source,'Missing test-only render hook');
        await route.fulfill({response,body});
      });
      await context.route('**/assets/sheet-persistence.js*',async route=>{
        const response=await route.fetch();const body=(await response.text()).replace('const create = factory();',
          'const originalCreate = factory(); const create = options => { root.__tricksOptions=options; const engine=originalCreate(options); root.__tricksEngine=engine; return engine; };');
        await route.fulfill({response,body});
      });
      await context.route('https://www.googleapis.com/**',async route=>{
        if(route.request().url().includes('/oauth2/v3/userinfo')){
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({email:'mariodevincenzodnd@gmail.com'})});return;
        }
        if(route.request().method()==='PATCH'){remote=route.request().postDataJSON();writes++;}
        else if(!remote)remote=await page.evaluate(()=>window.__tricksOptions.getState());
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(remote)});
      });
      await page.goto(base+'/'+file,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__tricksEngine?.isReady()&&document.getElementById('hp-cur')&&!document.getElementById('panels').inert);
      const result=await page.evaluate(()=>{
        const state=window.__tricksTest.getState(),snapshot=JSON.stringify(state);window.__tricksTest.render();
        const labels=[...document.querySelectorAll('#panel-poteri .trick-metadata')].map(e=>e.textContent);
        return {same:snapshot===JSON.stringify(state),labels,count:state.truccetti.filter(t=>!t.hidden).length};
      });
      assert.equal(result.same,true,'Rendering must not migrate canonical data');
      assert.equal(result.labels.length,result.count,file);
      assert.ok(result.labels.every(s=>s.includes('Quantità')));
      assert.equal(writes,0,'Loading/rendering must not save');
      await page.evaluate(()=>{document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.getElementById('panel-poteri').classList.add('active');});
      await page.screenshot({path:out+'/'+file.replace('.html','')+'-tricks-'+width+'.png',fullPage:true});
      await page.locator('.trick-metadata').first().locator('..').screenshot({path:out+'/'+file.replace('.html','')+'-trick-card-'+width+'.png'});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
      assert.equal(overflow,false,file+' player overflow');
      await page.evaluate(()=>window.__tricksTest.master());
      const master=await page.evaluate(()=>{
        const state=window.__tricksTest.getState(),snapshot=JSON.stringify(state);window.__tricksTest.render();
        return {same:snapshot===JSON.stringify(state),labels:[...document.querySelectorAll('.trick-metadata-input')].map(e=>e.value),overflow:document.documentElement.scrollWidth>innerWidth+2};
      });
      assert.equal(master.same,true);assert.equal(master.overflow,false,file+' master overflow');
      assert.equal(master.labels.length,result.count);
      // Rich text, split styling, conditional/variable CDs, and missing CDs.
      const fixtures=await page.evaluate(()=>{
        const data={truccetti:[
          {nome:'Split',uso:'Quantità - 3 -',desc:'<p><b>Testo</b> <span style="color:red">C</span><i>D 13</i></p>'},
          {nome:'Kill',uso:'3 x Riposo Lungo',desc:'Senza tiro. CD per uccidere 20 (solo in casi specifici).'},
          {nome:'Chaos',uso:'3',desc:'Tiro CD 16. Quando il pg ha Caos lvl 5, la CD sale a 18.'},
          {nome:'Variable',uso:'4',desc:'CD Variabile a sconda dell’elemento (Max 4 x Riposo Lungo)'},
          {nome:'Target',uso:'1',desc:'Nemici entro 6 caselle: TS Carisma CD 17. Danni invariati.'},
          {nome:'Missing',uso:'',desc:'Solo tiro opposto, nessuna difficoltà.'},
          {nome:'Already',uso:'CD 13',desc:'1D20 o 2d10.'},
          {nome:'Qty',uso:'',desc:'<p>Descrizione.</p><p>QUANTITA’ - 20 -</p>'}
        ],risorse:[{nome:'Already',max:3}]};
        const before=JSON.stringify(data),panel=document.createElement('div');
        panel.innerHTML=data.truccetti.map((t,i)=>`<div class="subcard"><span class="tag">Trucchetto</span><div class="rich" data-rich-arr="truccetti-${i}">${t.desc}</div></div>`).join('');
        MorgedalTricks.enhance(panel,data,false,()=>{throw new Error('unexpected save');});
        return {same:before===JSON.stringify(data),labels:[...panel.querySelectorAll('.trick-metadata')].map(e=>e.textContent),desc:[...panel.querySelectorAll('.rich')].map(e=>e.innerHTML)};
      });
      assert.ok(fixtures.same);assert.match(fixtures.labels[0],/CD 13/);assert.doesNotMatch(fixtures.desc[0],/D 13/);assert.match(fixtures.desc[0],/<b>Testo<\/b>/);
      assert.match(fixtures.labels[1],/per uccidere 20 \(solo in casi specifici\)/);
      assert.match(fixtures.labels[2],/CD 18 \(Caos lvl 5\)/);assert.match(fixtures.labels[3],/CD Variabile/);
      assert.match(fixtures.labels[4],/CD 17 \(TS Carisma\)/);assert.match(fixtures.desc[4],/Nemici entro 6 caselle: TS Carisma/);
      assert.doesNotMatch(fixtures.labels[5],/CD/);assert.match(fixtures.labels[6],/Quantità 3 · CD 13/);assert.match(fixtures.labels[7],/Quantità - 20 -/);
      // Real editor events use the existing queueSave; metadata survives reload.
      const editable=page.locator('[data-trick-metadata]').first();
      const originalHeader=await page.locator('.trick-metadata-input').first().inputValue();
      await editable.evaluate(el=>{el.insertAdjacentHTML('beforeend','<b> test modifica</b>');el.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.waitForFunction(()=>!window.__tricksEngine.isDirty());
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__tricksEngine?.isReady()&&document.getElementById('hp-cur'));
      await page.evaluate(()=>window.__tricksTest.master());
      assert.equal(await page.locator('.trick-metadata-input').first().inputValue(),originalHeader);
      assert.match(await page.locator('[data-trick-metadata]').first().innerHTML(),/test modifica/);
      const editedHeader='Quantità 7 · CD 12 (solo prova simulata)';
      await page.evaluate(()=>{document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.getElementById('panel-poteri').classList.add('active');});
      await page.locator('.trick-metadata-input').first().fill(editedHeader);
      await page.waitForFunction(()=>!window.__tricksEngine.isDirty());
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__tricksEngine?.isReady()&&document.getElementById('hp-cur'));
      await page.evaluate(()=>window.__tricksTest.master());
      assert.equal(await page.locator('.trick-metadata-input').first().inputValue(),editedHeader);
      assert.deepEqual(errors,[]);
      report.push({file,width,labels:master.labels,renderNoMutation:true,saveReload:true,noOverflow:true});
      console.log('PASS Trucchetti '+file+' '+width);
      await context.close();
    }
  }
}finally{await browser.close();await fs.writeFile(out+'/trick-metadata-report.json',JSON.stringify(report,null,2));}
