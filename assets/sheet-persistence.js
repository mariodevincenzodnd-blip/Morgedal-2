/* Shared persistence for the official character JSON. Pending journals contain no tokens. */
(function(root, factory){
  const create = factory();
  if (typeof module === "object" && module.exports) module.exports = create;
  else root.createMorgedalPersistence = create;
})(typeof window !== "undefined" ? window : globalThis, function(){
  "use strict";
  const canonical = value => JSON.stringify(value, function(_key, item){
    if (item && typeof item === "object" && !Array.isArray(item)){
      return Object.keys(item).sort().reduce((out, key) => { out[key] = item[key]; return out; }, {});
    }
    return item;
  });
  const valid = value => value && typeof value === "object" && !Array.isArray(value);
  return function createPersistence(options){
    let ready = false, base = null, revision = 0, acknowledged = 0;
    let saving = null, loading = null, timer = null, conflict = false;
    let journalKey = null, journalAvailable = true, generation = 0;
    const storage = options.draftStorage;
    const prefix = () => "morgedal-pending-v1:" + options.fileId + ":" +
      String(options.getIdentity() || "local").toLowerCase() + ":";
    const status = text => options.setStatus(text);
    const dirty = () => revision > acknowledged;
    const setBusy = value => { if (options.onBusy) options.onBusy(value); };
    const reportConflict = value => {
      conflict = value;
      if (options.onConflict) options.onConflict(value);
    };
    const key = () => prefix() + options.tabId;
    const readRecord = k => {
      try{
        const item = JSON.parse(storage.getItem(k) || "null");
        return item && item.fileId === options.fileId && typeof item.snapshot === "string" &&
          valid(JSON.parse(item.snapshot)) ? item : null;
      }catch(_error){ return null; }
    };
    function journal(){
      if (!ready || !dirty()) return;
      try{
        const currentKey = key();
        const record = { schema:1, fileId:options.fileId, identity:options.getIdentity() || "",
          owner:options.instanceId, base, snapshot:JSON.stringify(options.getState()), updatedAt:Date.now() };
        storage.setItem(currentKey, JSON.stringify(record));
        if (journalKey && journalKey !== currentKey){
          const previous = readRecord(journalKey);
          if (previous && previous.owner === options.instanceId) storage.removeItem(journalKey);
        }
        journalKey = currentKey;
        journalAvailable = true;
      }catch(_error){
        journalAvailable = false;
        status("Modifiche in attesa — backup temporaneo non disponibile; resta sulla scheda o esporta un backup");
      }
    }
    function removeOwnJournal(){
      try{
        if (!journalKey) return;
        const item = readRecord(journalKey);
        if (item && item.owner === options.instanceId) storage.removeItem(journalKey);
      }catch(_error){}
    }
    function pendingRecords(remote){
      const records = [];
      try{
        const keys = [];
        for (let i=0; i<storage.length; i++){
          const k = storage.key(i);
          if (k && k.startsWith(prefix())) keys.push(k);
        }
        for (const k of keys){
          const item = readRecord(k);
          if (!item) continue;
          if (canonical(JSON.parse(item.snapshot)) === canonical(remote)){
            storage.removeItem(k); // A write can have succeeded just before the page closed.
          } else records.push({key:k, item});
        }
      }catch(_error){}
      records.sort((a,b) => b.item.updatedAt - a.item.updatedAt);
      const own = records.find(record => record.key === key());
      return {records, selected:own || records[0]};
    }
    async function request(url, init){
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), options.requestTimeout || 20000) : null;
      try{
        const response = await options.fetch(url, {...init, cache:"no-store",
          ...(controller ? {signal:controller.signal} : {})});
        if (!response.ok){
          const error = new Error("Drive " + response.status);
          error.status = response.status;
          throw error;
        }
        return response;
      }finally{ if (timeout) clearTimeout(timeout); }
    }
    async function readRemote(token){
      const response = await request("https://www.googleapis.com/drive/v3/files/" +
        options.fileId + "?alt=media", {headers:{Authorization:"Bearer " + token}});
      const state = await response.json();
      if (!valid(state)) throw new Error("Il file Drive non contiene una scheda valida");
      return {state, etag:response.headers && response.headers.get("etag")};
    }
    function markChanged(){
      if (!ready) return false; // Initial defaults and failed loads must never reach Drive.
      revision++;
      journal();
      if (!conflict) status("Modifiche in attesa di salvataggio su Drive…");
      clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, options.debounce ?? 500);
      return true;
    }
    function allowLocal(){
      ready = true;
      setBusy(false);
      status("Scheda locale — collega Google Drive per sincronizzare");
    }
    async function commit(snapshot, token){
      const operation = async () => {
        const remote = await readRemote(token);
        const encoded = canonical(remote.state);
        if (encoded === canonical(JSON.parse(snapshot))){
          base = JSON.stringify(remote.state);
          return;
        }
        if (base === null || encoded !== canonical(JSON.parse(base))){
          const error = new Error("La versione Drive è cambiata");
          error.status = 409;
          throw error;
        }
        const headers = {Authorization:"Bearer " + token, "Content-Type":"application/json"};
        await request("https://www.googleapis.com/upload/drive/v3/files/" +
          options.fileId + "?uploadType=media", {method:"PATCH", headers, body:snapshot});
        base = snapshot;
      };
      if (options.withLock) return options.withLock("morgedal-drive-" + options.fileId, operation);
      return operation();
    }
    async function runSave(){
      while (ready && dirty() && !conflict){
        const sentRevision = revision;
        const snapshot = JSON.stringify(options.getState()); // Capture before the first await.
        journal();
        const token = options.getToken();
        let backupOk = true;
        try{ if (options.saveSecondary) backupOk = await options.saveSecondary(snapshot); }
        catch(_error){ backupOk = false; }
        if (!token){
          status("Modifiche conservate localmente, non sincronizzate — accedi a Google Drive");
          return false;
        }
        try{
          await commit(snapshot, token);
        }catch(error){
          if (error.status === 409 || error.status === 412){
            reportConflict(true);
            status("Versione Drive diversa — modifiche locali conservate; scegli quale versione usare");
          }else{
            status("Non salvato su Drive — " + (error.status === 401
              ? "accesso Google scaduto; accedi di nuovo" : "riprova il salvataggio o esporta un backup"));
          }
          if (options.onSaveResult) options.onSaveResult(false);
          journal();
          return false;
        }
        acknowledged = sentRevision;
        if (dirty()){
          journal();
          status("Salvataggio delle ultime modifiche su Drive…");
        }else{
          clearTimeout(timer);
          timer = null;
          removeOwnJournal();
          if (options.onSaveResult) options.onSaveResult(true);
          const time = new Date().toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"});
          status("Salvato su Drive ✓ " + time + (backupOk ? "" : " — backup locale non aggiornato"));
        }
      }
      return ready && !dirty() && !conflict;
    }
    function flush(){
      clearTimeout(timer);
      timer = null;
      if (saving) return saving;
      if (!ready || conflict) return Promise.resolve(false);
      if (!dirty()) return Promise.resolve(true);
      saving = runSave().finally(() => { saving = null; });
      return saving;
    }
    function load(discard){
      if (loading) return loading;
      loading = loadOnce(Boolean(discard)).finally(() => { loading = null; });
      return loading;
    }
    async function loadOnce(discard){
      const token = options.getToken();
      if (!token) return false;
      if (!discard && dirty() && !(await flush())) return false;
      if (discard && saving) await saving;
      const requestedRevision = revision, requestedGeneration = ++generation;
      setBusy(true);
      status("Caricamento della scheda da Drive…");
      try{
        const remote = await readRemote(token);
        if (requestedGeneration !== generation || (!discard && revision !== requestedRevision)){
          status("Modifiche locali conservate — caricamento tardivo ignorato");
          return false;
        }
        if (discard){
          removeOwnJournal();
          acknowledged = revision;
          reportConflict(false);
        }
        const pending = discard ? {records:[], selected:null} : pendingRecords(remote.state);
        base = JSON.stringify(remote.state);
        ready = true;
        acknowledged = revision;
        reportConflict(false);
        if (pending.selected){
          const record = pending.selected.item;
          base = record.base;
          const divergent = pending.records.length > 1 || base === null ||
            canonical(JSON.parse(base)) !== canonical(remote.state);
          reportConflict(divergent);
          options.applyState(JSON.parse(record.snapshot));
          revision++;
          journal();
          // Keep a journal from another tab until it is explicitly resolved there.
          if (pending.selected.key === key()) journalKey = key();
          status(divergent
            ? "Modifiche recuperate; Drive contiene una versione diversa — scegli quale versione usare"
            : "Modifiche non sincronizzate recuperate — salvataggio su Drive in corso…");
          if (!divergent) void flush();
        }else{
          options.applyState(remote.state);
          if (!dirty()) status("Caricato da Google Drive ✓");
        }
        return true;
      }catch(error){
        if (options.onLoadError) options.onLoadError(error);
        status("Caricamento Drive non riuscito — riprova; nessun dato predefinito verrà salvato");
        return false;
      }finally{ setBusy(!ready); }
    }
    async function resolveConflict(){
      if (!conflict || !dirty()) return false;
      const token = options.getToken();
      if (!token) return false;
      try{
        const remote = await readRemote(token);
        base = JSON.stringify(remote.state);
        reportConflict(false);
        journal();
        return await flush();
      }catch(_error){
        status("Impossibile verificare Drive — modifiche locali conservate");
        return false;
      }
    }
    async function resume(){
      if (dirty() && !(await flush())) return false;
      return load(false);
    }
    function attachLifecycle(win, doc){
      const preserve = () => { journal(); if (dirty()) void flush(); };
      doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "hidden") preserve(); });
      win.addEventListener("pagehide", preserve);
      win.addEventListener("pageshow", event => { if (event.persisted) void resume(); });
      win.addEventListener("online", () => { if (dirty() && !conflict) void flush(); });
      win.addEventListener("beforeunload", event => {
        if (!dirty()) return;
        journal();
        event.preventDefault();
        event.returnValue = "";
      });
      doc.addEventListener("click", event => {
        const anchor = event.target && event.target.closest && event.target.closest("a[href]");
        if (!anchor || !dirty() || event.defaultPrevented || event.button !== 0 ||
            event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
            anchor.target === "_blank" || anchor.hasAttribute("download")) return;
        const url = new URL(anchor.href, win.location.href);
        if (url.origin !== win.location.origin || url.pathname === win.location.pathname &&
            url.search === win.location.search) return;
        event.preventDefault();
        void flush().then(ok => { if (ok) win.location.href = url.href; });
      }, true);
    }
    return {markChanged, flush, load, allowLocal, resolveConflict, resume, attachLifecycle,
      isDirty:dirty, isReady:() => ready, hasConflict:() => conflict,
      hasPendingBackup:() => journalAvailable, preserve:journal};
  };
});
