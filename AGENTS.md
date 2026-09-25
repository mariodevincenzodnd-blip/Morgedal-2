# Morgedal 2 — efficient agent instructions

Keep repository context as small as possible.

- Never scan or read the whole repository unless the task explicitly requires a repo-wide audit.
- The `*_Scheda_Interattiva.html` files are large. For a character-specific task, inspect only that character's file and only the relevant sections.
- Before opening a large HTML file, locate the target with exact text, IDs, function names, labels, or other unique markers; then read the smallest surrounding range needed.
- Do not open multiple character sheets merely to compare patterns. Use the closest relevant example only when the target file is insufficient.
- For bulk changes, inspect one representative file first, identify the exact pattern, then search/apply narrowly across the affected files.
- Do not reread unchanged large files during the same task unless new evidence makes it necessary.
- Ignore assets and unrelated files unless they are directly required by the requested change.
- Prefer minimal diffs. Do not reformat, regenerate, or rewrite large files when a focused edit is possible.
- Run only checks relevant to the changed files and requested behavior; avoid unrelated broad audits or repeated checks.
- Preserve existing site behavior and canonical character/lore text unless the user explicitly requests a change.
- Finish the requested implementation and verify the affected path, but avoid extra exploratory work not needed for the task.
