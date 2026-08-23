---
name: agent-speed
description: Keep DSH agent turns fast — grep over giant reads, quote shell, no fluff, no emoji. Use on long coding/exploration tasks.
---

# Agent speed (solo coder)

## Do
- Prefer `grep` / `glob` / `bash rg` before `read`
- For huge files: search pattern → read only a window (skill `search-large-files`)
- `read` with `limit` ≤ 200 (≤120 after a grep hit)
- Quote shell globs/regex: `'feature.*('`
- One-shot: Write share file → one run → one answer
- Large: `projects/<slug>/` + `create_goal` + modular files (skill `large-project`)
- UI pages: real CSS/fonts (skill `frontend-ui`) — not bare blue links
- ASCII status: `[OK]` / `[FAIL]` / `[WARN]`

## Don't
- Page multi-kLoC files end-to-end / `cat` whole dumps
- Share-root README/LICENSE for toy scripts
- `todo_write`, bare `pwd`/`ls`, `pip --break-system-packages`
- Emoji in source or filenames
- Unstyled HTML (default Times + blue `<a>` lists)
- Second farewell summary

## Paths
- Host: `<HOST_SHARE>\...`
- Large: `<HOST_SHARE>\projects\<slug>\`
- bash: `/mnt/hostshare/...` or `/mnt/hostshare/projects/<slug>/`
