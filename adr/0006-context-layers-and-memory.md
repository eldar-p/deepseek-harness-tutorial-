# 0006 — Context layers and memory.json

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Локальные модели имеют ограниченное KV; длинные tool-loops раздувают input. Нужна политика «что помнить где».

## Decision

Четыре слоя (см. `assets/CONTEXT.md`):

| Layer | Store |
|-------|--------|
| Code / logs | `workspace/` |
| AI facts (consent) | `.deep/memory.json` |
| Session | DSH + compaction |
| KV | llama (drop on stop) |

DSH config (`cordis.deep.patch.yml`):

- `compaction-basic`: auto at 50% window, retain 15%
- `tool-result-pruner`: 4k char threshold

Bootstrap seeds empty `memory.json` from `assets/memory.template.json`.

## Consequences

- Старые детали после compaction могут сжаться — важное на диск
- Secrets never in memory.json (documented)
- Alpha: AGENTS.md rules for when to write memory
