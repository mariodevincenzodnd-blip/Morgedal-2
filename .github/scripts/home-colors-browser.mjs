import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(process.env.MORGEDAL_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.VISUAL_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({headless:true, channel:process.env.MORGEDAL_CHROME_CHANNEL || "chrome"});
const mock = { identityColor:"#1166cc", identityColor2:"#cc2255", hp:87, risorse:[{used:3,max:18}], lore:"unchanged", extra:{keep:[1,2,3]} };
let count = 0;
async function setup(width=1280,email="mariodevincenzodnd@gmail.com"){
  const context = await browser.newContext({viewport:{width,height:950}});
  const records = new Map(), writes = [], errors=[];
  let failWrite=false, failRead=false;
  await context.addInitScript(()=>{
    sessionStorage.setItem("morgedal-google-token-v4-shared",JSON.stringify({token:"mock-token",expiresAt:Date.now()+3600000}));
  });
  await context.route("https://accounts.google.com/gsi/client",route=>route.fulfill({body:'window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}};',contentType:"text/javascript"}));
  await context.route("https://www.googleapis.com/oauth2/v3/userinfo*",route=>route.fulfill({json:{email}}));
  await context.route(/https:\/\/www\.googleapis\.com\/(?:upload\/)?drive\//,async route=>{
    const req=route.request(), id=new URL(req.url()).pathname.split("/").pop();
    if (!records.has(id)) records.set(id,structuredClone(mock));
    if (req.method()==="PATCH"){
      if(failWrite) return route.fulfill({status:503,body:"{}"});
      const state=req.postDataJSON(); writes.push({id,state}); records.set(id,state);
    }else if(failRead) return route.fulfill({status:403,body:"{}"});
    return route.fulfill({json:records.get(id)});
  });
  const page=await context.newPage(); page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/index.html?home=1");
  await page.waitForSelector("body.auth-ready");
  const first=page.locator('.character-tile[data-character-file="Katan_Scheda_Interattiva.html"]');
  return {context,page,first,records,writes,errors,setFailWrite:v=>failWrite=v,setFailRead:v=>failRead=v};
}
const waitSaved = async tile=>tile.locator('[role="status"]').filter({hasText:"Salvato su Drive"}).waitFor();
const edit = async (tile,field,value)=>tile.locator(`[data-color="${field}"]`).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));},value);
try{
  for(const width of [1440,390]){
    const t=await setup(width); const {page,first,writes}=t;
    await page.locator('#home-color-toggle').waitFor();
    assert.equal(await page.locator('.home-color-editor:visible').count(),0);
    await page.click('#home-color-toggle');
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-color="first"]')].every(el=>!el.disabled));
    assert.equal(await page.locator('.home-color-editor:visible').count(),12);
    assert.equal(writes.length,0); // Reading/rendering never writes.
    for(const tile of await page.locator('.character-tile').all()){
      await edit(tile,"first","#123456"); await edit(tile,"second","#fedcba"); await waitSaved(tile);
      assert.match(await tile.locator('.colorbar').getAttribute('style'),/18, 52, 86.*254, 220, 186/);
    }
    for(const write of writes){ const {identityColor,identityColor2,...rest}=write.state;
      const {identityColor:a,identityColor2:b,...expected}=mock; assert.deepEqual(rest,expected); }
    await page.reload(); await page.click('#home-color-toggle');
    await page.waitForFunction(()=>document.querySelector('[data-color="first"]').value==="#123456");
    assert.equal(await first.locator('[data-color="second"]').inputValue(),"#fedcba");
    await first.locator('[data-action="solid"]').click(); await waitSaved(first);
    assert.equal(t.records.get("1nNUTm4s9JIny4p5Ach6TWCN9BuIMSbnq").identityColor2,null);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await fs.mkdir("visual-report",{recursive:true}); await page.screenshot({path:`visual-report/home-colors-${width}.png`,fullPage:true});
    assert.deepEqual(t.errors,[]); count+=12; await t.context.close();
  }
  {
    const t=await setup(); await t.page.click('#home-color-toggle');
    await t.first.locator('[data-color="first"]:enabled').waitFor();
    t.setFailWrite(true); await edit(t.first,"second","#aabbcc");
    await t.first.locator('[role="status"]').filter({hasText:"Non salvato"}).waitFor();
    assert.equal(t.writes.length,0);
    await t.page.reload(); await t.page.click('#home-color-toggle');
    await t.page.waitForFunction(()=>document.querySelector('.character-tile[data-character-file="Katan_Scheda_Interattiva.html"] [data-color="second"]').value==="#aabbcc");
    await t.first.locator('[role="status"]').filter({hasText:"Non salvato"}).waitFor();
    t.setFailWrite(false); await t.first.locator('[data-action="retry"]').click(); await waitSaved(t.first);
    t.records.get("1nNUTm4s9JIny4p5Ach6TWCN9BuIMSbnq").hp=42;
    const before=t.writes.length; await edit(t.first,"first","#abcdef");
    await t.first.locator('.home-color-conflict:visible').waitFor();
    assert.equal(t.writes.length,before); assert.equal(t.records.get("1nNUTm4s9JIny4p5Ach6TWCN9BuIMSbnq").hp,42);
    t.page.once('dialog',d=>d.accept()); await t.first.locator('[data-action="reload"]').click();
    await t.first.locator('[role="status"]').filter({hasText:"Caricato"}).waitFor();
    assert.equal(await t.first.locator('[data-color="first"]').inputValue(),"#1166cc");
    assert.deepEqual(t.errors,[]); count+=4; await t.context.close();
  }
  {
    const t=await setup(390,"genchi.walter@gmail.com");
    assert.equal(await t.page.locator('#home-color-toggle:visible').count(),0);
    assert.equal(await t.page.locator('.home-color-editor:visible').count(),0);
    await t.page.evaluate(()=>{const i=document.querySelector('[data-color="first"]');i.value="#010101";i.dispatchEvent(new Event("change",{bubbles:true}));});
    assert.equal(t.writes.length,0); count++; await t.context.close();
  }
  {
    const t=await setup(); t.setFailRead(true); await t.page.reload(); await t.page.click('#home-color-toggle');
    await t.first.locator('[role="status"]').filter({hasText:"non riuscito"}).waitFor();
    assert.equal(await t.first.locator('[data-color="first"]').isDisabled(),true);
    assert.equal(t.writes.length,0); t.setFailRead(false); await t.first.locator('[data-action="retry"]').click();
    await t.first.locator('[data-color="first"]:enabled').waitFor(); count++; await t.context.close();
  }
  console.log(`Home colors: ${count} desktop/mobile and persistence cases passed; Drive mocked.`);
}finally{ await browser.close(); }
