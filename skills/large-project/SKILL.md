---
name: large-project
description: Grow multi-file apps inside the GIM workspace without losing structure. Modular layout, small reads.
---

# Large / complex projects

## Where

Everything under the **stack workspace**:

```text
~/.gim/workspace/<stack>/
  my-app/
    STRUCTURE.txt    # optional map (not marketing README)
    src/
    tests/
    scripts/
```

Guest sees the same tree at `/workspace/my-app/`.

Do not scatter files outside the workspace. Do not overwrite unrelated root docs unless asked.

## How not to get lost

1. First write a short **tree plan** (`STRUCTURE.txt` or first `ask_user` turn) — dirs + entrypoints only.
2. **One concern per file** — many small modules over one giant script.
3. After each module: smallest check (`guest_bash` test, import, `--help`).
4. Navigation: `search_files` / `rg` under project dir — never read multi-kLoC files whole.
5. Prefer stdlib; venv/node_modules **inside** the project folder via `guest_bash`.
6. ASCII status in code: `[OK]` / `[FAIL]`. No emoji in filenames or source.
7. Docs only when user asked, or brief module docstrings.

## Agent modes

- **Agent / Debug** — full six tools
- **Plan / Ask** — clarify with `ask_user` before big rewrites

## Anti-patterns

- Single 2k-line file for an app
- `pip install --break-system-packages` in guest without venv
- LICENSE/README spam for every toy script
- Re-listing directory between every write
