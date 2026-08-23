# DSH — VM bash only · solo model

## Path map (never mix)

| Side | Path |
|------|------|
| Windows host (Read/Write/Edit/Glob) | `<HOST_SHARE>\...` |
| Debian VM (bash) | `<VM_MOUNT>/...` |

**Same file:** `<HOST_SHARE>\foo.py` ↔ `<VM_MOUNT>/foo.py`

**Large projects:** `<HOST_SHARE>\projects\<slug>\` ↔ `<VM_MOUNT>/projects/<slug>/`

Safety nets:
- OS junction for invented `...\mnt\hostshare` → real share
- FS plugin remaps `/home/kodachi/...`, `/tmp/...` → share

**Forbidden:** `/home/kodachi/...` or `/tmp/...` as Write targets.

## Shell / Network

- Tool **`bash` only**. Never `pwsh` / host package managers.
- Tor: `curl --socks5-hostname 127.0.0.1:9050`

## No emoji

ASCII only: `[OK]` / `[FAIL]` / `[WARN]`.

## Huge files

`grep` / `rg -n` first → `read` limit≤120 around hits. Skill `search-large-files`.

## Frontend

No bare Times + blue-link pages. Skill `frontend-ui`.

## One-shot vs large

- **One-shot:** one file on share + one run + one answer. No root README/LICENSE/todo/pwd.
- **Large:** `projects/<slug>/` + `create_goal` + `STRUCTURE.txt` + modules + optional `.venv` + `complete_goal`. Skill `large-project`.

## Hard deny

`one-shot-guard`: todo_write; probe bash; bare pip; root README/LICENSE; emoji in source.

If `[one-shot-guard] denied` → **Write the script immediately**. Assume `python3` exists.

## Speed + STOP

- Prefer `grep` / `glob` / targeted `read`. Quote shell patterns.
- Max 2 retries on the same path error.
- **STOP:** one final answer. Never paste the same summary 2–3 times.
