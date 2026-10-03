import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const {chromium} = await import(process.env.MORGEDAL_PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.PERSISTENCE_BASE_URL || "http://127.0.0.1:4173";
assert.ok(["127.0.0.1","localhost"].includes(new URL(baseUrl).hostname), "Mocks are restricted to localhost");
const output = process.env.PERSISTENCE_REPORT_DIR || "visual-report";
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:"chrome"});
const report = [], remote = new Map(), traffic = [];
let failWrites=false, gate=null, writesInProgress=0, maxWrites=0;
const clone = value=>JSON.parse(JSON.stringify(value));
async function newContext(viewport={width:1440,height:1000}){
  const context = await browser.newContext({viewport});
  await context.addInitScript(()=>{
    const token={token:"persistence-browser-fake",expiresAt:Date.now()+3600000};
    sessionStorage.setItem("morgedal-google-token-v4-shared",JSON.stringify(token));
    sessionStorage.setItem("morgedal-google-token-v2",JSON.stringify(token));
  });
  await context.route("https://accounts.google.com/**",route=>route.abort());
  await context.route("https://apis.google.com/**",route=>route.abort());
  await context.route("**/assets/sheet-persistence.js*",async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace("const create = factory();",
      "const originalCreate = factory(); const create = options => { root.__persistenceOptions = options; const engine = originalCreate(options); root.__persistenceEngine = engine; return engine; };");
    await route.fulfill({response,body});
  });
  await context.route("https://www.googleapis.com/**",async route=>{
    const request=route.request(),url=request.url();
    if(url.includes("/oauth2/v3/userinfo")){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({email:"mariodevincenzodnd@gmail.com"})});
      return;
    }
    const match=url.match(/\/files\/([^?]+)/);
    assert.ok(match,"Unexpected Google request: "+url);
    const id=match[1],method=request.method();
    traffic.push({id,method});
    if(method==="PATCH"){
      writesInProgress++;maxWrites=Math.max(maxWrites,writesInProgress);
      if(gate) await gate.promise;
      if(failWrites){
        writesInProgress--;
        await route.fulfill({status:500,contentType:"application/json",body:'{"error":"test failure"}'});
        return;
      }
      remote.set(id,request.postDataJSON());
      writesInProgress--;
    }else{
      if(!remote.has(id)){
        const fixture=await request.frame().page().evaluate(()=>window.__persistenceOptions.getState());
        remote.set(id,clone(fixture));
      }
    }
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(remote.get(id))});
  });
  return context;
}
async function ready(page){
  await page.waitForFunction(()=>window.__persistenceEngine?.isReady() &&
    document.getElementById("hp-cur") && !document.getElementById("panels").inert);
}
async function saved(page,value){
  await page.waitForFunction(value=>window.__persistenceEngine &&
    !window.__persistenceEngine.isDirty() && !window.__persistenceEngine.hasConflict() &&
    (value===null || window.__persistenceOptions.getState().hpCur===value),value);
}
async function hp(page){return page.locator("#hp-cur").inputValue().then(Number);}
const files=(await fs.readdir(".")).filter(f=>f.endsWith("_Scheda_Interattiva.html")&&!f.includes("_QA_")).sort();
try{
  for(const file of files){
    const context=await newContext(),page=await context.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(baseUrl+"/"+file,{waitUntil:"domcontentloaded"});
    await ready(page);await saved(page,null);
    const initial=await hp(page),value=initial>0?initial-1:1;
    await page.locator("#hp-cur").fill(String(value));await saved(page,value);
    await page.reload({waitUntil:"domcontentloaded"});await ready(page);
    assert.equal(await hp(page),value);
    await page.goto(baseUrl+"/index.html?home=1",{waitUntil:"domcontentloaded"});
    await page.goto(baseUrl+"/"+file,{waitUntil:"domcontentloaded"});await ready(page);
    assert.equal(await hp(page),value);
    await page.goBack({waitUntil:"domcontentloaded"});
    await page.goForward({waitUntil:"domcontentloaded"});await ready(page);
    assert.equal(await hp(page),value);
    assert.deepEqual(errors,[]);
    report.push({sheet:file,saveReloadHomeHistory:"PASS"});
    console.log("PASS save/reload/home/history: "+file);
    await context.close();
  }
  const context=await newContext(),page=await context.newPage();
  page.on("dialog",dialog=>dialog.accept());
  const file="Katan_Scheda_Interattiva.html";
  await page.goto(baseUrl+"/"+file,{waitUntil:"domcontentloaded"});await ready(page);await saved(page,null);
  const id=await page.evaluate(()=>window.__persistenceOptions.fileId);
  const original=await hp(page),pending=original>2?original-2:3;
  failWrites=true;
  await page.locator("#hp-cur").fill(String(pending));
  await page.waitForFunction(()=>document.getElementById("savebar-status").textContent.startsWith("Non salvato su Drive"));
  assert.ok(await page.evaluate(()=>window.__persistenceEngine.isDirty()));
  await page.reload({waitUntil:"domcontentloaded"});await ready(page);
  assert.equal(await hp(page),pending);
  await page.waitForFunction(()=>document.getElementById("savebar-status").textContent.startsWith("Non salvato su Drive"));
  failWrites=false;
  await page.locator("#savebar-toggle").click();
  await page.locator("#btn-save-now").click();await saved(page,pending);
  assert.equal(remote.get(id).hpCur,pending);
  report.push({test:"failed-write-reload-recovery-and-retry",result:"PASS"});
  console.log("PASS failed write/reload/recovery/retry");
  let release;
  gate={promise:new Promise(resolve=>release=resolve)};
  const startTraffic=traffic.length;
  await page.locator("#hp-cur").fill(String(pending-1));
  await page.waitForFunction(()=>window.__persistenceEngine.isDirty());
  // Wait for the mocked server to observe the first PATCH, without sleeping.
  for(let i=0;i<200 && !traffic.slice(startTraffic).some(t=>t.method==="PATCH");i++) await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert.ok(traffic.slice(startTraffic).some(t=>t.method==="PATCH"));
  await page.locator("#hp-cur").fill(String(pending-2));
  release();gate=null;
  await saved(page,pending-2);
  assert.equal(remote.get(id).hpCur,pending-2);assert.equal(maxWrites,1);
  report.push({test:"overlap-serializes-and-keeps-newest-edit",result:"PASS"});
  console.log("PASS serial writer/newest edit");
  gate={promise:new Promise(resolve=>release=resolve)};
  const beforeHome=traffic.length;
  await page.locator("#hp-cur").fill(String(pending-3));
  for(let i=0;i<200 && !traffic.slice(beforeHome).some(t=>t.method==="PATCH");i++) await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert.ok(traffic.slice(beforeHome).some(t=>t.method==="PATCH"));
  await page.locator('a[href="index.html?home=1"]').click();
  assert.ok(page.url().endsWith(file),"Home navigation must wait for the pending save");
  release();gate=null;
  await page.waitForURL("**/index.html?home=1");
  assert.equal(remote.get(id).hpCur,pending-3);
  await page.goto(baseUrl+"/"+file,{waitUntil:"domcontentloaded"});await ready(page);await saved(page,null);
  assert.equal(await hp(page),pending-3);
  report.push({test:"home-link-waits-for-pending-save",result:"PASS"});
  console.log("PASS home link waits for pending save");
  const refreshed=clone(remote.get(id));refreshed.hpCur=pending-4;remote.set(id,refreshed);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true})));
  await page.waitForFunction(value=>Number(document.getElementById("hp-cur").value)===value,pending-4);
  report.push({test:"bfcache-resume-refreshes-remote-state",result:"PASS"});
  console.log("PASS bfcache resume");
  const second=await context.newPage();
  await second.goto(baseUrl+"/"+file,{waitUntil:"domcontentloaded"});await ready(second);await saved(second,null);
  await page.locator("#hp-cur").fill(String(pending-5));await saved(page,pending-5);
  const patchesBefore=traffic.filter(t=>t.method==="PATCH").length;
  await second.locator("#hp-cur").fill(String(pending-6));
  await second.waitForFunction(()=>window.__persistenceEngine.hasConflict());
  assert.equal(remote.get(id).hpCur,pending-5);
  assert.equal(traffic.filter(t=>t.method==="PATCH").length,patchesBefore);
  assert.equal(await second.locator("#sheet-sync-conflict").isVisible(),true);
  report.push({test:"stale-second-tab-conflict-no-overwrite",result:"PASS"});
  console.log("PASS stale second tab conflict");
  await second.screenshot({path:path.join(output,"persistence-conflict.png")});
  await page.screenshot({path:path.join(output,"persistence-katan-desktop.png")});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,"persistence-katan-mobile.png")});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  // Discard the mock conflict before teardown; this only changes mocked state.
  await second.evaluate(()=>window.__persistenceEngine.load(true));
  await context.close();
  await fs.writeFile(path.join(output,"persistence-report.json"),JSON.stringify({total:report.length,report},null,2));
  console.log("Persistence browser checks passed: "+report.length);
} finally {
  await browser.close();
}
