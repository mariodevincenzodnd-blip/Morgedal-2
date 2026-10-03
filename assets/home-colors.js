/* Home and sheets share identityColor / identityColor2 in the official Drive JSON. */
(() => {
  "use strict";
  const FILE_IDS = {
    "Katan_Scheda_Interattiva.html":"1nNUTm4s9JIny4p5Ach6TWCN9BuIMSbnq",
    "Ervork_Scheda_Interattiva.html":"1tBZnu9ccbfokqhmlfVwurJ0XWSFe63j_",
    "Ola_Scheda_Interattiva.html":"1Ow6TcqqH8gS9vnPVcPny7IRmpZt_pwPS",
    "Lux_Scheda_Interattiva.html":"1fx2p5DpIPq-TeOMiCxSYzFxMQZjb4og0",
    "Aggron_Scheda_Interattiva.html":"1xnfbyqxys8L8IEwhQ7eh39LYvseX07BC",
    "Gorg_Scheda_Interattiva.html":"1Z6nSu5Lef4epKsh_CPYKnbdJ2bL5iG6G",
    "Jhaggork_Scheda_Interattiva.html":"1uz4HkI6ITe2HXOnzpzgZUo2ASkDLjW5s",
    "Niger_Scheda_Interattiva.html":"1oThXjvonu729xvmiNF4kzN8P7yXho_3z",
    "Vorkax_Scheda_Interattiva.html":"1JT24yPQbHKDnNxKObfJ2Ni2_sRNKHn24",
    "Bull_Scheda_Interattiva.html":"14LfwpTgPIN4nWMO4KrasvohFFlt-SFWb",
    "Crop_Scheda_Interattiva.html":"1yhbW0qKLP7JGwIK-k9moSzLTiRlmEHnF",
    "Mary_Scheda_Interattiva.html":"1RvrC0HfaGd4cQPvBKPIwo4XDK-OLSW6x"
  };
  const hex = value => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  const toggle = document.getElementById("home-color-toggle");
  const entries = new Map();
  let currentEmail = "", generation = 0, editorOn = false;
  const isMaster = () => document.body.classList.contains("auth-ready") &&
    isGoogleMasterEmail(currentEmail) && sessionStorage.getItem(MASTER_UNLOCK_KEY) === "1";
  const apply = (entry, color, color2) => {
    const c1 = hex(color) ? color : entry.character.color;
    const c2 = hex(color2) ? color2 : c1;
    entry.card.style.setProperty("--card-color", c1);
    entry.card.style.setProperty("--card-accent", `linear-gradient(90deg, ${c1}, ${c2})`);
    entry.card.querySelector(".colorbar").style.background = `linear-gradient(180deg, ${c1}, ${c2})`;
  };
  function updateControls(entry){
    const disabled = !isMaster() || entry.busy || !entry.controller?.isReady() || entry.controller.hasConflict();
    entry.panel.hidden = !editorOn || !isMaster();
    entry.first.disabled = entry.second.disabled = entry.solid.disabled = disabled;
    // A failed first load remains unready/busy in the shared engine, but retry
    // must remain available. load() itself coalesces overlapping requests.
    entry.retry.disabled = !isMaster();
    entry.conflict.hidden = !entry.controller?.hasConflict();
  }
  function hideEditor(){
    editorOn = false;
    toggle.setAttribute("aria-pressed", "false");
    document.body.classList.remove("home-colors-on");
    toggle.hidden = !isMaster();
    entries.forEach(updateControls);
  }
  window.hideHomeColorEditor = hideEditor;
  toggle.addEventListener("click", () => {
    if (!isMaster()) return;
    editorOn = !editorOn;
    toggle.setAttribute("aria-pressed", String(editorOn));
    document.body.classList.toggle("home-colors-on", editorOn);
    entries.forEach(updateControls);
  });
  function change(entry, second, value){
    if (!isMaster() || !entry.controller?.isReady() || entry.busy || entry.controller.hasConflict()) return;
    entry.state[second ? "identityColor2" : "identityColor"] = value;
    apply(entry, entry.state.identityColor, entry.state.identityColor2);
    entry.controller.markChanged();
  }
  for (const character of CHARACTERS){
    const tile = [...document.querySelectorAll(".character-tile")].find(el => el.dataset.characterFile === character.file);
    if (!tile || !FILE_IDS[character.file]) continue;
    const panel = document.createElement("div");
    panel.className = "home-color-editor";
    panel.hidden = true;
    panel.innerHTML = `<div class="home-color-fields">
      <label>Colore 1 <input type="color" data-color="first" aria-label="Colore 1 di ${character.name}"></label>
      <label>Colore 2 <input type="color" data-color="second" aria-label="Colore 2 di ${character.name}"></label>
      </div><div class="home-color-actions"><button type="button" data-action="solid">Colore unico</button>
      <button type="button" data-action="retry">Riprova / aggiorna</button></div>
      <p class="home-color-status" role="status">Caricamento colori…</p>
      <div class="home-color-conflict" hidden><p>La scheda è cambiata su Drive. Esporta le modifiche prima di ricaricare la versione aggiornata.</p>
      <button type="button" data-action="export">Esporta backup</button>
      <button type="button" data-action="reload">Ricarica Drive</button></div>`;
    tile.appendChild(panel);
    const entry = {character, panel, card:tile.querySelector(".card"), state:null, controller:null, busy:true,
      first:panel.querySelector('[data-color="first"]'), second:panel.querySelector('[data-color="second"]'),
      solid:panel.querySelector('[data-action="solid"]'), retry:panel.querySelector('[data-action="retry"]'),
      status:panel.querySelector('[role="status"]'), conflict:panel.querySelector('.home-color-conflict')};
    entries.set(character.file, entry);
    entry.first.value = character.color;
    entry.second.value = character.color2 || character.color;
    for (const [input, second] of [[entry.first,false],[entry.second,true]]){
      input.addEventListener("input", () => {
        if (!isMaster() || input.disabled) return;
        const c1 = second ? entry.state.identityColor || character.color : input.value;
        const c2 = second ? input.value : entry.state.identityColor2;
        apply(entry, c1, c2);
      });
      input.addEventListener("change", () => change(entry, second, input.value));
    }
    entry.solid.addEventListener("click", () => {
      change(entry, true, null);
      entry.second.value = entry.first.value;
    });
    entry.retry.addEventListener("click", () => {
      if (!isMaster()) return;
      if (entry.controller?.isDirty()) void entry.controller.flush();
      else void entry.controller?.load();
    });
    panel.querySelector('[data-action="reload"]').addEventListener("click", () => {
      if (!isMaster() || !confirm("Ricaricare Drive scartando le modifiche locali di questo personaggio?")) return;
      void entry.controller.load(true);
    });
    panel.querySelector('[data-action="export"]').addEventListener("click", () => {
      if (!isMaster() || !entry.state) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(entry.state,null,2)], {type:"application/json"}));
      const link = document.createElement("a");
      link.href = url; link.download = character.name + "-backup-colori.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function controllerFor(entry, email){
    let tabId;
    try{
      tabId = sessionStorage.getItem("morgedal-home-colors-tab-v1") || crypto.randomUUID();
      sessionStorage.setItem("morgedal-home-colors-tab-v1", tabId);
    }catch(_error){ tabId = String(Date.now()) + "-" + Math.random(); }
    // Home never resumes unrelated unsaved sheet edits automatically. Sheets can
    // still discover a pending Home snapshot through their normal shared journal.
    const homeKeys = () => Object.keys(localStorage).filter(key=>key.includes(":home-colors-"));
    const homeDrafts = {
      get length(){ return homeKeys().length; }, key:index=>homeKeys()[index] || null,
      getItem:key=>localStorage.getItem(key), setItem:(key,value)=>localStorage.setItem(key,value),
      removeItem:key=>localStorage.removeItem(key)
    };
    return window.createMorgedalPersistence({
      fileId:FILE_IDS[entry.character.file], tabId:"home-colors-" + tabId,
      instanceId:crypto.randomUUID(), draftStorage:homeDrafts,
      getIdentity:()=>email, getToken:()=>isMaster() && currentEmail === email ? loadGoogleTokenFromSession() : null,
      getState:()=>entry.state, fetch:(url, init)=>fetch(url,init),
      withLock:navigator.locks ? (name, callback)=>navigator.locks.request(name, callback) : null,
      applyState:state=>{
        if (currentEmail !== email) return;
        entry.state = state;
        apply(entry, state.identityColor, state.identityColor2);
        entry.first.value = hex(state.identityColor) ? state.identityColor : entry.character.color;
        entry.second.value = hex(state.identityColor2) ? state.identityColor2 : entry.first.value;
      },
      setStatus:text=>{ if (currentEmail === email) entry.status.textContent = text; },
      onBusy:busy=>{ if (currentEmail === email){ entry.busy = busy; updateControls(entry); } },
      onConflict:()=>queueMicrotask(()=>updateControls(entry))
    });
  }
  window.refreshHomeColors = async email => {
    if (currentEmail === email && entries.values().next().value?.controller){
      hideEditor();
      if (isMaster()) await Promise.all([...entries.values()].map(entry=>entry.controller.resume()));
      return;
    }
    const turn = ++generation;
    currentEmail = email;
    hideEditor();
    const token = loadGoogleTokenFromSession();
    await Promise.all([...entries.values()].map(async entry => {
      if (isMaster()){
        entry.controller = controllerFor(entry,email);
        await entry.controller.load();
      }else{
        entry.controller = null;
        apply(entry,entry.character.color,entry.character.color2);
        if (!token) return;
        try{
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_IDS[entry.character.file]}?alt=media`,
            {headers:{Authorization:"Bearer " + token},cache:"no-store"});
          if (!res.ok) return;
          const state = await res.json();
          if (turn === generation) apply(entry,state.identityColor,state.identityColor2);
        }catch(_error){ /* Keep the published palette when read access is unavailable. */ }
      }
    }));
  };
  const flushAll = async () => (await Promise.all([...entries.values()].filter(e=>e.controller?.isDirty())
    .map(e=>e.controller.flush()))).every(Boolean);
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    const accountButton = event.target.closest("#btn-google-home, #master-logout");
    if ((!link && !accountButton) || event.defaultPrevented || event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
      link?.hasAttribute("download") || link?.target === "_blank") return;
    if (![...entries.values()].some(e=>e.controller?.isDirty())) return;
    if (accountButton?.id === "btn-google-home" && !loadGoogleTokenFromSession()){
      // Re-authentication must remain possible when a pending save has no token.
      entries.forEach(e=>e.controller?.preserve());
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    void flushAll().then(ok=>{
      if (!ok){ editorOn = isMaster(); document.body.classList.toggle("home-colors-on",editorOn);
        toggle.setAttribute("aria-pressed",String(editorOn)); entries.forEach(updateControls); return; }
      if (link) window.location.href = link.href;
      else accountButton.click();
    });
  },true);
  const preserve = () => { entries.forEach(e=>e.controller?.preserve()); void flushAll(); };
  window.addEventListener("pagehide",preserve);
  document.addEventListener("visibilitychange",()=>{ if (document.hidden) preserve(); });
  window.addEventListener("online",()=>void flushAll());
  window.addEventListener("pageshow",event=>{
    if (event.persisted) entries.forEach(e=>{ if (e.controller) void e.controller.resume(); });
  });
  window.addEventListener("beforeunload",event=>{
    if (![...entries.values()].some(e=>e.controller?.isDirty())) return;
    entries.forEach(e=>e.controller?.preserve()); event.preventDefault(); event.returnValue = "";
  });
  if (document.body.classList.contains("auth-ready")){
    void window.refreshHomeColors(sessionStorage.getItem(GOOGLE_EMAIL_STORAGE_KEY) || "");
  }
})();
