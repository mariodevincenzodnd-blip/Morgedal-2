from pathlib import Path
import os, shutil

ROOT = Path(__file__).parent
OUT = ROOT / "dist"
EXCLUDE = {".git", ".github", "dist", "__pycache__"}

AUTOMATION_STORAGE_KEY = "morgedal-tinyfish-qa-v1"
AUTOMATION_TOKEN_HASH = "e573727ecf9027b1df7bd0755bfd245d4603f07edef8baeb27821b1737b54fc7"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

for p in ROOT.iterdir():
    if p.name in EXCLUDE:
        continue
    dst = OUT / p.name
    if p.is_dir():
        shutil.copytree(p, dst)
    else:
        shutil.copy2(p, dst)

key = os.environ.get("MORGEDAL_PICKER_API_KEY", "").strip()
marker = "__MORGEDAL_PICKER_API_KEY__"
changed = 0

if key:
    for p in OUT.rglob("*.html"):
        s = p.read_text(encoding="utf-8")
        if marker in s:
            p.write_text(s.replace(marker, key), encoding="utf-8")
            changed += 1
    print(f"Prepared Vercel output in {OUT} and injected Picker key into {changed} HTML file(s).")
else:
    print("Prepared Vercel output without Picker key; site will use manual Picker-key fallback until Vercel env is available.")

def inject_flag(html: str) -> str:
    marker_head = "</head>"
    if marker_head not in html:
        raise RuntimeError("HTML senza </head>: impossibile inserire il flag QA.")
    script = f"""<script>
try {{
  window.__MORGEDAL_TINYFISH_QA__ = localStorage.getItem("{AUTOMATION_STORAGE_KEY}") === "1";
}} catch (e) {{
  window.__MORGEDAL_TINYFISH_QA__ = false;
}}
</script>
"""
    return html.replace(marker_head, script + marker_head, 1)

def patch_index(path: Path):
    s = inject_flag(path.read_text(encoding="utf-8"))

    old = "function initGoogleIndex(){\n"
    new = """function initGoogleIndex(){
  if (window.__MORGEDAL_TINYFISH_QA__){
    try{
      sessionStorage.setItem(MASTER_UNLOCK_KEY, "1");
      sessionStorage.removeItem("morgedal-master-editor");
    }catch(e){}
    showHomeForAuthenticatedUser(GOOGLE_OWNER_EMAIL);
    refreshMasterBadge();
    return;
  }
"""
    if old not in s:
        raise RuntimeError("Hook initGoogleIndex non trovato in index.html")
    s = s.replace(old, new, 1)

    old = """function ensureGoogleSignInThenGo(href){
  const proceed = ()=>{ window.location.href = href; };
"""
    new = """function ensureGoogleSignInThenGo(href){
  const proceed = ()=>{ window.location.href = href; };
  if (window.__MORGEDAL_TINYFISH_QA__){
    proceed();
    return;
  }
"""
    if old not in s:
        raise RuntimeError("Hook ensureGoogleSignInThenGo non trovato in index.html")
    s = s.replace(old, new, 1)

    path.write_text(s, encoding="utf-8")

def patch_sheet(path: Path):
    s = inject_flag(path.read_text(encoding="utf-8"))
    old = "async function initLock(){\n"
    new = """async function initLock(){
  if (window.__MORGEDAL_TINYFISH_QA__){
    markMasterUnlocked();
    setMasterEditorOn(false);
    hideLockScreen();
    init();
    return;
  }
"""
    if old not in s:
        raise RuntimeError(f"Hook initLock non trovato in {path.name}")
    s = s.replace(old, new, 1)
    path.write_text(s, encoding="utf-8")

def patch_admin(path: Path):
    s = inject_flag(path.read_text(encoding="utf-8"))
    old = "let unlocked = false;\n"
    new = """if (window.__MORGEDAL_TINYFISH_QA__){
  try{
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(MASTER_UNLOCK_KEY, "1");
    sessionStorage.removeItem("morgedal-master-editor");
  }catch(e){}
}

let unlocked = false;
"""
    if old not in s:
        raise RuntimeError("Hook admin unlock non trovato in admin.html")
    s = s.replace(old, new, 1)
    path.write_text(s, encoding="utf-8")

def write_tinyfish_entry(path: Path):
    page = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morgedal — Accesso QA</title>
<style>
body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f0d0c;color:#ece3d0;font-family:system-ui,sans-serif}}
main{{max-width:520px;padding:28px;border:1px solid #3d3024;border-radius:14px;background:#1b1613;text-align:center}}
h1{{color:#eecb7c;font-size:22px}}p{{color:#a89880;line-height:1.55}}
</style>
</head>
<body>
<main>
  <h1>Accesso QA Morgedal</h1>
  <p id="status">Verifica autorizzazione in corso…</p>
</main>
<script>
const KEY = "{AUTOMATION_STORAGE_KEY}";
const EXPECTED = "{AUTOMATION_TOKEN_HASH}";
const statusEl = document.getElementById("status");

async function sha256Hex(text){{
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}}
function unlockSession(){{
  try{{
    localStorage.setItem(KEY, "1");
    sessionStorage.setItem("morgedal-master-unlocked", "1");
    sessionStorage.setItem("morgedal-admin-unlocked", "1");
    sessionStorage.removeItem("morgedal-master-editor");
  }}catch(e){{}}
}}
function goHome(){{
  history.replaceState(null, "", location.pathname);
  location.replace("index.html?home=1");
}}

(async ()=>{{
  const fragment = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (fragment === "revoke"){{
    try{{ localStorage.removeItem(KEY); }}catch(e){{}}
    statusEl.textContent = "Autorizzazione QA rimossa.";
    history.replaceState(null, "", location.pathname);
    return;
  }}

  try{{
    if (localStorage.getItem(KEY) === "1"){{
      unlockSession();
      goHome();
      return;
    }}
  }}catch(e){{}}

  if (!fragment){{
    statusEl.textContent = "Autorizzazione QA non presente.";
    return;
  }}

  const digest = await sha256Hex(fragment);
  if (digest !== EXPECTED){{
    statusEl.textContent = "Autorizzazione QA non valida.";
    history.replaceState(null, "", location.pathname);
    return;
  }}

  unlockSession();
  goHome();
}})();
</script>
</body>
</html>
"""
    path.write_text(page, encoding="utf-8")

index_path = OUT / "index.html"
if index_path.exists():
    patch_index(index_path)

sheet_count = 0
for p in OUT.glob("*_Scheda_Interattiva.html"):
    patch_sheet(p)
    sheet_count += 1

admin_path = OUT / "admin.html"
if admin_path.exists():
    patch_admin(admin_path)

write_tinyfish_entry(OUT / "tinyfish-access.html")
print(f"TinyFish QA access prepared in build output: home + {sheet_count} sheet(s) + admin.")
