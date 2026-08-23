---
name: search-large-files
description: Find symbols/strings inside huge files without reading them whole. Use before Read on large sources, dumps, bundles, logs, or when locating a function/class/config key.
---

# Search inside large files (do not swallow whole file)

## Rule
If a file may be big (unknown size, dump, bundle, generated, >~300 lines): **search first, then Read a window**. Never `read` from line 1 with no limit.

## Host tools
- `grep` with pattern + path (and `glob` if needed)
- Then `read` with `offset` near the hit and `limit` ≤ 80–120

## VM bash
```bash
rg -n 'pattern' '/mnt/hostshare/path/to/file' | head -40
rg -n -C 3 'pattern' '/mnt/hostshare/path/to/file' | head -80
# or
grep -nE 'pattern' '/mnt/hostshare/path/to/file' | head -40
```
Quote patterns: `'foo.*Bar('`.

## Workflow
1. Name what you need (function, string, CSS class, import).
2. `rg`/`grep` → get line numbers.
3. `read` only that slice (`offset`/`limit`).
4. Edit that region. Re-grep to verify.

## Don't
- `read` entire `main.tsx`, minified JS, JSON dumps, session logs
- `cat` / `sed -n '1,5000p'` huge files into context
- Multiple overlapping full-file reads after a search already found the lines
