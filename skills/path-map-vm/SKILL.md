---
name: path-map-vm
description: Windows host vs Debian VM path map and bash-only shell. Use before any file or shell operation on this machine.
---

# Path map + shell

| Tool | Path |
|------|------|
| Read / Write / Edit / Glob (host) | `<HOST_SHARE>\...` |
| bash (VM) | `/mnt/hostshare/...` |

**Same file:** `<HOST_SHARE>\foo.py` ↔ `/mnt/hostshare/foo.py`

## Forbidden Write targets
- `/home/kodachi/...`, `/tmp/...`
- `F:\home\...`, `F:\tmp\...`
- Prefer canonical `<HOST_SHARE>\...` (not `<HOSTSHARE_JUNCTION>\...`)
- Mixed Windows+Linux paths

If Write returns a path **outside** `<HOST_SHARE>\`, treat it as failure: rewrite under share and retry **once**.

## Script / demo pattern (one-shot)
1. `Write` → `<HOST_SHARE>\thing.py`
2. `bash` → `python3 /mnt/hostshare/thing.py ...`
3. Short answer with path. **Stop.**
4. Skip unless asked: README, todos, `python --version`, second summary
5. Max 2 retries on the same error
6. No emoji in code or script output — use `[OK]` / `[FAIL]`

## Shell
Tool **`bash` only** (already SSH into VM). Never `pwsh`, never `Get-ChildItem`.

Check: `uname -a` → Linux. List: `ls /mnt/hostshare`.
