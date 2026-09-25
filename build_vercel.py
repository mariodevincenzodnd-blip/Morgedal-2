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
if not key:
    raise SystemExit("Missing MORGEDAL_PICKER_API_KEY")

marker = "__MORGEDAL_PICKER_API_KEY__"
changed = 0
for p in OUT.rglob("*.html"):
    s = p.read_text(encoding="utf-8")
    if marker in s:
        p.write_text(s.replace(marker, key), encoding="utf-8")
        changed += 1

if changed == 0:
    raise SystemExit("Picker key marker not found in HTML files")

print(f"Prepared Vercel output in {OUT} and injected Picker key into {changed} HTML file(s).")
