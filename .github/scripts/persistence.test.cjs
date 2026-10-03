const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const create = require("../../assets/sheet-persistence.js");
function deferred(){ let resolve; const promise = new Promise(r=>resolve=r); return {promise,resolve}; }
class Storage {
  data=new Map();
  get length(){return this.data.size;}
  key(i){return [...this.data.keys()][i];}
  getItem(k){return this.data.get(k)||null;}
  setItem(k,v){this.data.set(k,v);}
  removeItem(k){this.data.delete(k);}
}
function fixture(custom={}){
  let state={nome:"TEST",value:1}, remote={nome:"TEST",value:1}, token="fake";
  const statuses=[], requests=[], storage=custom.storage||new Storage();
  const options={
    fileId:"official-test",tabId:"tab-test",instanceId:custom.instanceId||"instance-a",
    draftStorage:storage,getIdentity:()=>"test@example.invalid",
    getToken:()=>token,getState:()=>state,applyState:s=>{state=structuredClone(s);},
    setStatus:s=>statuses.push(s),debounce:60000,
    fetch:async(url,init)=>{
      requests.push({url,method:init.method||"GET",body:init.body,cache:init.cache,headers:init.headers});
      if (custom.fetch) return custom.fetch(url,init);
      if(init.method==="PATCH") remote=JSON.parse(init.body);
      return {ok:true,status:200,headers:{get:()=>null},json:async()=>structuredClone(remote)};
    },
    ...custom.options
  };
  const engine=create(options);
  return {engine,options,storage,statuses,requests,
    get state(){return state;},get remote(){return remote;},
    setState:s=>{state=s;},setRemote:s=>{remote=s;},setToken:t=>{token=t;}};
}
test("unchanged page and repeated lifecycle flushes never PATCH",async()=>{
  const f=fixture();await f.engine.load();
  await Promise.all([f.engine.flush(),f.engine.flush(),f.engine.flush()]);
  assert.equal(f.requests.filter(r=>r.method==="PATCH").length,0);
});
test("defaults cannot overwrite Drive before the first successful load",async()=>{
  const f=fixture();f.engine.markChanged();assert.equal(await f.engine.flush(),false);
  assert.equal(f.requests.length,0);
});
test("failed initial load stays unready; errors cannot save defaults",async()=>{
  const f=fixture({fetch:async()=>({ok:false,status:403})});
  assert.equal(await f.engine.load(),false);
  f.engine.markChanged();await f.engine.flush();
  assert.equal(f.engine.isReady(),false);assert.equal(f.requests.length,1);
});
test("snapshot is stable while a secondary destination is delayed; final newest edit is saved",async()=>{
  const gate=deferred(), backups=[];
  let first=true;
  const f=fixture({options:{saveSecondary:async snapshot=>{backups.push(JSON.parse(snapshot));if(first){first=false;await gate.promise;}return true;}}});
  await f.engine.load();f.state.value=2;f.engine.markChanged();
  const save=f.engine.flush();
  f.state.value=3;f.engine.markChanged();gate.resolve();assert.equal(await save,true);
  assert.deepEqual(backups.map(x=>x.value),[2,3]);
  assert.deepEqual(f.requests.filter(r=>r.method==="PATCH").map(r=>JSON.parse(r.body).value),[2,3]);
  assert.equal(f.remote.value,3);assert.equal(f.engine.isDirty(),false);
});
test("all callers share one serial writer; Saved is withheld until the latest revision",async()=>{
  const gate=deferred();let pending=0,maxPending=0,patches=0,remote={nome:"TEST",value:1};
  const f=fixture({fetch:async(url,init)=>{
    if(init.method==="PATCH"){pending++;maxPending=Math.max(maxPending,pending);patches++;
      if(patches===1)await gate.promise;
      remote=JSON.parse(init.body);pending--;
    }
    return {ok:true,headers:{get:()=>null},json:async()=>structuredClone(remote)};
  }});
  await f.engine.load();f.state.value=2;f.engine.markChanged();
  const a=f.engine.flush();const b=f.engine.flush();assert.equal(a,b);
  f.state.value=3;f.engine.markChanged();assert.ok(!f.statuses.at(-1).startsWith("Salvato"));
  gate.resolve();assert.equal(await a,true);assert.equal(maxPending,1);assert.equal(remote.value,3);
});
test("late load cannot replace an edit made while waiting",async()=>{
  let remote={nome:"TEST",value:1},gate=null;
  const f=fixture({fetch:async()=>{if(gate)await gate.promise;return {ok:true,headers:{get:()=>null},json:async()=>structuredClone(remote)};}});
  await f.engine.load();remote.value=7;gate=deferred();const load=f.engine.load();
  f.state.value=3;f.engine.markChanged();gate.resolve();assert.equal(await load,false);
  assert.equal(f.state.value,3);assert.equal(f.engine.isDirty(),true);
  // Resolve the dirty revision for timer cleanup; leave the conflict journal intact.
  await f.engine.flush();
});
test("a stale tab detects changed remote data and sends no PATCH",async()=>{
  const f=fixture();await f.engine.load();f.state.value=2;f.engine.markChanged();
  f.setRemote({nome:"TEST",value:8});assert.equal(await f.engine.flush(),false);
  assert.equal(f.remote.value,8);assert.equal(f.engine.hasConflict(),true);
  assert.equal(f.requests.filter(r=>r.method==="PATCH").length,0);
  assert.equal(f.storage.length,1);
});
test("secondary success and expired OAuth never report Drive success",async()=>{
  let reads=0;
  const f=fixture({options:{saveSecondary:async()=>true},fetch:async()=>++reads===1?
    {ok:true,headers:{get:()=>null},json:async()=>({nome:"TEST",value:1})}:{ok:false,status:401}});
  await f.engine.load();f.state.value=2;f.engine.markChanged();assert.equal(await f.engine.flush(),false);
  assert.ok(!f.statuses.some(s=>s.startsWith("Salvato")));
  assert.equal(f.engine.isDirty(),true);assert.equal(f.storage.length,1);
});
test("pending draft survives reload and resumes without losing newer edits",async()=>{
  const first=fixture();await first.engine.load();first.state.value=5;first.engine.markChanged();
  const second=fixture({storage:first.storage,instanceId:"instance-b"});
  await second.engine.load();assert.equal(second.state.value,5);
  await second.engine.flush();assert.equal(second.remote.value,5);assert.equal(second.storage.length,0);
  first.setToken(null);await first.engine.flush();
});
test("write applied before unload is recognized and is not sent a second time",async()=>{
  const first=fixture();await first.engine.load();first.state.value=5;first.engine.markChanged();
  const second=fixture({storage:first.storage,instanceId:"instance-b"});
  second.setRemote({nome:"TEST",value:5});await second.engine.load();
  assert.equal(second.engine.isDirty(),false);assert.equal(second.storage.length,0);
  assert.equal(second.requests.filter(r=>r.method==="PATCH").length,0);
  first.setToken(null);await first.engine.flush();
});
test("recovered draft with changed remote data requires a choice; never overwrites automatically",async()=>{
  const first=fixture();await first.engine.load();first.state.value=5;first.engine.markChanged();
  const second=fixture({storage:first.storage,instanceId:"instance-b"});
  second.setRemote({nome:"TEST",value:8});await second.engine.load();await second.engine.flush();
  assert.equal(second.state.value,5);assert.equal(second.remote.value,8);assert.ok(second.engine.hasConflict());
  assert.equal(second.requests.filter(r=>r.method==="PATCH").length,0);
  first.setToken(null);await first.engine.flush();
});
test("explicit remote choice discards only this instance's pending changes",async()=>{
  const f=fixture();await f.engine.load();f.state.value=5;f.engine.markChanged();
  f.setRemote({nome:"TEST",value:8});await f.engine.flush();await f.engine.load(true);
  assert.equal(f.state.value,8);assert.equal(f.engine.isDirty(),false);assert.equal(f.storage.length,0);
});
test("explicit local choice uses a freshly verified remote baseline",async()=>{
  const f=fixture();await f.engine.load();f.state.value=5;f.engine.markChanged();
  f.setRemote({nome:"TEST",value:8});await f.engine.flush();assert.equal(await f.engine.resolveConflict(),true);
  assert.equal(f.remote.value,5);assert.equal(f.engine.hasConflict(),false);
});
test("journal failures retain dirty state and never turn a failed Drive write into Saved",async()=>{
  const storage=new Storage();storage.setItem=()=>{throw new Error("quota");};let reads=0;
  const f=fixture({storage,fetch:async()=>++reads===1?
    {ok:true,headers:{get:()=>null},json:async()=>({nome:"TEST",value:1})}:{ok:false,status:500}});
  await f.engine.load();f.state.value=2;f.engine.markChanged();await f.engine.flush();
  assert.equal(f.engine.hasPendingBackup(),false);assert.equal(f.engine.isDirty(),true);
  assert.ok(!f.statuses.some(s=>s.startsWith("Salvato")));
});
test("Drive conflict response preserves changes and all reads bypass cache",async()=>{
  let reads=0;
  const f=fixture({fetch:async(_url,init)=>init.method==="PATCH"?{ok:false,status:412}:
    {ok:true,headers:{get:()=>'"version-'+(++reads)+'"'},json:async()=>({nome:"TEST",value:1})}});
  await f.engine.load();f.state.value=2;f.engine.markChanged();await f.engine.flush();
  assert.ok(f.requests.some(r=>r.method==="PATCH"));
  assert.ok(f.requests.every(r=>r.cache==="no-store"));assert.ok(f.engine.hasConflict());assert.equal(f.storage.length,1);
});
test("all twelve production sheets compile, share the engine, and keep unique official storage IDs",()=>{
  const dir=path.resolve(__dirname,"../..");
  const files=fs.readdirSync(dir).filter(f=>f.endsWith("_Scheda_Interattiva.html")&&!f.includes("_QA_"));
  assert.equal(files.length,12);
  const keys=new Set(),ids=new Set();
  for(const f of files){
    const h=fs.readFileSync(path.join(dir,f),"utf8");
    assert.match(h,/assets\/sheet-persistence\.js\?v=20261003-1/);
    assert.match(h,/return getSheetPersistence\(\)\.flush\(\)/);
    keys.add(h.match(/const STORAGE_KEY = "([^"]+)"/)[1]);
    ids.add(h.match(/const DEFAULT_DRIVE_FILE_ID = "([^"]+)"/)[1]);
    for(const m of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1],{filename:f});
  }
  assert.equal(keys.size,12);assert.equal(ids.size,12);
});
