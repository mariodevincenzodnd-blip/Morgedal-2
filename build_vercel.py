from pathlib import Path
import os, shutil

ROOT = Path(__file__).parent
OUT = ROOT / "dist"
EXCLUDE = {".git", ".github", "dist", "__pycache__"}

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
