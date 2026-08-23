---
name: large-project
description: Scaffold and grow large multi-file codebases under share/projects without getting lost. Use for apps, packages, complex structures, many modules, or long builds.
---

# Large / complex projects

## Where
Everything under one slug:

| Host | VM |
|------|-----|
| `<HOST_SHARE>\projects\<slug>\` | `/mnt/hostshare/projects/<slug>/` |

Never dump big trees onto share root. Never overwrite unrelated root `README.md`.

## How not to get lost
1. **`create_goal`** with the end state (what "done" means). Update/complete as you go.
2. First write a short **tree plan** (in the goal or one `STRUCTURE.txt` inside the project) — dirs + main entrypoints only.
3. **One concern per file.** Prefer many small modules over one giant script.
4. Typical layout (adapt to language):

```text
projects/<slug>/
  STRUCTURE.txt          # optional map (not a marketing README)
  src/ or lib/           # code
  tests/                 # if testing
  scripts/               # runners
  .venv/                 # python deps only here
```

5. After each module: run the smallest check (import, unit test, or CLI help). Do not rewrite the whole tree.
6. Prefer **stdlib** first. If deps needed: `python3 -m venv /mnt/hostshare/projects/<slug>/.venv` then pip *into that venv*.
7. Navigation: `grep` / `glob` under `projects/<slug>` — never page multi-kLoC files end-to-end (`read` limit ≤ 200).
8. ASCII only in code (`[OK]` / `[FAIL]`). No emoji.
9. Docs: only if user asked, or a brief `STRUCTURE.txt` / module docstrings — not share-root LICENSE/README spam.
10. When done: **`complete_goal`**, one short summary with the project path.

## Anti-patterns
- One 2k-line file for an app
- `pip install --break-system-packages` on the VM
- Root-level README/LICENSE for every toy script
- Re-listing `pwd`/`ls` between every write
