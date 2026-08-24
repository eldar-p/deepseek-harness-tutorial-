---
name: search-large-files
description: Find symbols in huge files without reading them whole. Use search_files or guest_bash rg before read_file.
---

# Search inside large files

## Rule

If size unknown, generated, minified, or likely **>300 lines**: **search first, read a window only**.

## Agent tools (preferred)

```
search_files  pattern="export function foo"  path="src"
read_file     path="src/module.js"           # only after you know the region — host may truncate at 8 KB
```

Use `guest_bash` when ripgrep is needed inside the guest:

```bash
cd /workspace && rg -n 'pattern' path/to/file | head -40
cd /workspace && rg -n -C 3 'pattern' path/to/file | head -80
```

Quote regex: `'foo.*Bar\('`.

## Workflow

1. Name the target (function, import, config key, CSS class).
2. `search_files` or `rg -n` → line numbers.
3. `read_file` the smallest useful slice (or bash `sed -n '120,180p'` in guest).
4. Edit. Re-search to verify.

## Don't

- `read_file` on entire bundles, logs, or `node_modules`
- `cat` / `head -n 5000` huge files into the model context
- Multiple full-file reads after search already found the lines
