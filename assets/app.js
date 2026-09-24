(() => {
  const cfg = window.MORGEDAL_CONFIG;
  const CHARACTERS = [
    {slug:"katan",label:"KATAN",full:"KATANEL (KATAN) MARTINELLI",type:"PRINCIPALE",className:"GUERRIERO TELECINETICO 8",color:"#2e9bff",fileId:"1nNUTm4s9JIny4p5Ach6TWCN9BuIMSbnq"},
    {slug:"ervork",label:"ERVORK",full:"ERVORK SHADRUN",type:"PRINCIPALE",className:"GUERRIERO DEMONIACO LVL. 8",color:"#d43b3b",fileId:"1tBZnu9ccbfokqhmlfVwurJ0XWSFe63j_"},
    {slug:"ola",label:"OLA",full:"OLA BANDOLEROS",type:"PRINCIPALE",className:"IBRIDO DISTRUTTORE LVL. 8",color:"#9450d8",fileId:"1Ow6TcqqH8gS9vnPVcPny7IRmpZt_pwPS"},
    {slug:"lux",label:"LUX",full:"LUX",type:"PRINCIPALE",className:"EVOCATORE CELESTE LVL. 8",color:"#ffffff",fileId:"1fx2p5DpIPq-TeOMiCxSYzFxMQZjb4og0"},
    {slug:"aggron",label:"AGGRON",full:"AGGRON",type:"VIAGGIATORE",className:"GUERRIERO STREGONE LVL. 8",color:"#6b8f4e",fileId:"1xnfbyqxys8L8IEwhQ7eh39LYvseX07BC"},
    {slug:"gorg",label:"GORG",full:"GORG",type:"VIAGGIATORE",className:"CAMPIONE DEL CAOS",color:"#4fae54",color2:"#d6409f",fileId:"1Z6nSu5Lef4epKsh_CPYKnbdJ2bL5iG6G"}
  ];

  const ACCESS = {
    "mariodevincenzodnd@gmail.com": {label:"Master",characters:["*"],master:true},
    "genchi.walter@gmail.com": {label:"Katan",characters:["katan"]},
    "dray1286@gmail.com": {label:"Ervork",characters:["ervork"]},
    "nicoladmn@gmail.com": {label:"Ola",characters:["ola"]},
    "ivandevincenzo18052005@gmail.com": {label:"Lux",characters:["lux"]},
    "rocco.scotellaro93@gmail.com": {label:"AGGRON",characters:["aggron"]},
    "manudegiorgi999@gmail.com": {label:"Gorg",characters:["gorg"]},
    "savimusciagna@gmail.com": {label:"Jhaggork",characters:[]},
    "markogiga25@gmail.com": {label:"Niger",characters:[]},
    "jigenmail98@gmail.com": {label:"Vorkax",characters:[]},
    "pabloderubautenze@gmail.com": {label:"Bull",characters:[]},
    "pabloderuba@gmail.com": {label:"Bull",characters:[]},
    "marinanapoletano1998@gmail.com": {label:"Crop",characters:[]},
    "annamaria.romanocyr@gmail.com": {label:"Mary",characters:[]}
  };

  const els = {
    login:document.getElementById("loginBtn"),
    logout:document.getElementById("logoutBtn"),
    account:document.getElementById("accountPill"),
    master:document.getElementById("masterPill"),
    drive:document.getElementById("drivePill"),
    loginPanel:document.getElementById("loginPanel"),
    pickerPanel:document.getElementById("pickerPanel"),
    picker:document.getElementById("pickerBtn"),
    toast:document.getElementById("toast")
  };

  let tokenClient = null;
  let accessToken = null;
  let currentGrant = null;
  let currentEmail = "";
  let pickerReady = false;
  let toastTimer = null;

  function toast(message,bad=false){
    clearTimeout(toastTimer);
    els.toast.textContent=message;
    els.toast.className="toast show"+(bad?" bad":"");
    toastTimer=setTimeout(()=>els.toast.className="toast",3200);
  }

  function allAllowed(grant){return !!grant?.characters?.includes("*")}
  function canAccess(slug){return allAllowed(currentGrant)||currentGrant?.characters?.includes(slug)}

  function renderCards(){
    document.querySelectorAll(".character-card").forEach(card=>{
      const slug=card.dataset.slug;
      const allowed=!!currentGrant&&canAccess(slug);
      card.dataset.access=allowed?"allowed":"locked";
      card.querySelector(".card-lock").textContent=allowed?"ACCESSO":"BLOCCATA";
    });
  }

  async function loadCharacterData(){
    if(!accessToken||!currentGrant)return;
    const targets=CHARACTERS.filter(c=>canAccess(c.slug));
    for(const ch of targets){
      try{
        const r=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(ch.fileId)+"?alt=media",{
          headers:{Authorization:"Bearer "+accessToken}
        });
        if(!r.ok)continue;
        const data=await r.json();
        const card=document.querySelector('[data-slug="'+ch.slug+'"]');
        if(!card)continue;
        card.querySelector(".character-class").textContent=data.classe||ch.className;
        card.dataset.fullName=data.nome||ch.full;
        if(data.identityColor)card.style.setProperty("--accent",data.identityColor);
      }catch(e){console.warn("Drive read failed",ch.slug,e)}
    }
  }

  async function verifyFiles(){
    if(!accessToken||!currentGrant)return {ok:0,total:0,missing:[]};
    const targets=CHARACTERS.filter(c=>canAccess(c.slug));
    let ok=0; const missing=[];
    for(const ch of targets){
      try{
        const r=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(ch.fileId)+"?fields=id,name",{
          headers:{Authorization:"Bearer "+accessToken}
        });
        if(r.ok)ok++; else missing.push(ch);
      }catch(_){missing.push(ch)}
    }
    return {ok,total:targets.length,missing};
  }

  function updateSignedOut(){
    currentGrant=null;currentEmail="";
    els.account.hidden=true;
    els.master.hidden=true;
    els.drive.hidden=true;
    els.logout.hidden=true;
    els.login.hidden=false;
    els.loginPanel.hidden=false;
    els.pickerPanel.classList.remove("show");
    renderCards();
  }

  async function handleToken(response){
    els.login.disabled=false;
    if(response.error||!response.access_token){toast("Accesso Google non completato.",true);return}
    accessToken=response.access_token;
    try{
      const r=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+accessToken}});
      if(!r.ok)throw new Error("userinfo");
      const profile=await r.json();
      if(!profile.email_verified)throw new Error("email");
      currentEmail=String(profile.email||"").toLowerCase();
      currentGrant=ACCESS[currentEmail];
      if(!currentGrant){
        toast("Questo account Google non è autorizzato per Morgedal.",true);
        revoke();
        return;
      }

      els.account.textContent=currentGrant.master?"MASTER · "+profile.email:currentGrant.label+" · "+profile.email;
      els.account.hidden=false;
      els.master.hidden=!currentGrant.master;
      els.drive.hidden=false;
      els.logout.hidden=false;
      els.login.hidden=true;
      els.loginPanel.hidden=true;
      renderCards();

      sessionStorage.setItem("morgedal-user-email",currentEmail);
      sessionStorage.setItem("morgedal-user-role",currentGrant.label);
      sessionStorage.setItem("morgedal-master-editor","off");

      const status=await verifyFiles();
      if(status.total&&status.ok===status.total){
        els.drive.textContent="DRIVE · COLLEGATO";
        els.drive.classList.add("ok");
        els.pickerPanel.classList.remove("show");
        sessionStorage.setItem("morgedal-drive-ready","true");
        await loadCharacterData();
        toast(currentGrant.master?"Accesso Master verificato.":"Accesso "+currentGrant.label+" verificato.");
      }else{
        els.drive.textContent="DRIVE · DA AUTORIZZARE";
        els.drive.classList.remove("ok");
        els.pickerPanel.classList.add("show");
        sessionStorage.removeItem("morgedal-drive-ready");
        toast("Autorizza i file Drive necessari per questo account.",true);
      }
    }catch(e){
      console.error(e);
      toast("Non è stato possibile verificare l'identità Google.",true);
      revoke();
    }
  }

  function revoke(){
    if(accessToken&&window.google?.accounts?.oauth2){
      google.accounts.oauth2.revoke(accessToken,()=>{});
    }
    accessToken=null;
    sessionStorage.removeItem("morgedal-user-email");
    sessionStorage.removeItem("morgedal-user-role");
    sessionStorage.removeItem("morgedal-drive-ready");
    sessionStorage.setItem("morgedal-master-editor","off");
    updateSignedOut();
  }

  function initGoogle(){
    if(!window.google?.accounts?.oauth2){setTimeout(initGoogle,120);return}
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:cfg.clientId,
      scope:"openid email profile https://www.googleapis.com/auth/drive.file",
      include_granted_scopes:true,
      callback:handleToken
    });
    els.login.disabled=false;
    if(window.gapi)gapi.load("picker",()=>{pickerReady=true});
  }

  function openPicker(){
    if(!accessToken){toast("Accedi prima con Google.",true);return}
    if(!pickerReady||!window.google?.picker){toast("Google Picker non è ancora pronto.",true);return}
    const targets=CHARACTERS.filter(c=>canAccess(c.slug));
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setParent(cfg.baseFolderId)
      .setMimeTypes("application/json")
      .setMode(google.picker.DocsViewMode.LIST);
    const picker=new google.picker.PickerBuilder()
      .setAppId(cfg.appId)
      .setOAuthToken(accessToken)
      .setDeveloperKey(cfg.pickerKey)
      .setOrigin(window.location.origin)
      .addView(view)
      .setCallback(async data=>{
        if(data.action!==google.picker.Action.PICKED)return;
        const status=await verifyFiles();
        if(status.ok===status.total){
          els.drive.textContent="DRIVE · COLLEGATO";
          els.drive.classList.add("ok");
          els.pickerPanel.classList.remove("show");
          await loadCharacterData();
          toast("File Drive autorizzati.");
        }else{
          toast("Autorizzati "+status.ok+" su "+status.total+". Seleziona anche i rimanenti.",true);
        }
      }).build();
    picker.setVisible(true);
  }

  document.querySelectorAll(".character-card").forEach(card=>{
    card.addEventListener("click",()=>{
      const slug=card.dataset.slug;
      if(!currentGrant){toast("Accedi con Google per aprire una scheda.",true);return}
      if(!canAccess(slug)){toast("Questo account non è autorizzato per questa scheda.",true);return}
      const label=card.dataset.fullName||card.querySelector(".character-name").textContent;
      toast(label+" · accesso pronto. Costruiamo ora la scheda completa.");
      history.replaceState(null,"","#"+slug);
    });
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();card.click()}});
  });

  els.login.addEventListener("click",()=>{
    if(!tokenClient)return;
    els.login.disabled=true;
    tokenClient.requestAccessToken({prompt:"select_account"});
  });
  els.logout.addEventListener("click",()=>{revoke();toast("Sessione Google chiusa.")});
  els.picker.addEventListener("click",openPicker);

  updateSignedOut();
  window.addEventListener("load",initGoogle);
})();