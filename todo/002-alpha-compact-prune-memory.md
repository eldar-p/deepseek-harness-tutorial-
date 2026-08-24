# 002 — Compaction, pruner, memory.json

**Status:** ✅ done  
**Priority:** P0  
**ADR:** [006-context-layers-and-memory](../adr/006-context-layers-and-memory.md)

## Goal

Длинные сессии без раздувания контекста: DSH compaction + tool-result pruner + дисковая память.

## Checklist

- [x] `cordis.deep.patch.yml`: `compaction-basic` (threshold 0.5, retain 0.15)
- [x] `cordis.deep.patch.yml`: `tool-result-pruner` (4k threshold)
- [x] `assets/CONTEXT.md` — правила слоёв контекста
- [x] `assets/memory.template.json` + seed в `materializeAssets`
- [x] `assets/AGENTS.deep.md` — правила memory.json (user consent)
- [x] `/compact` + long session — `docs/TROUBLESHOOTING.md`

## Verify

После `deep bootstrap`:

```bash
cat ~/.deep/workspace/default/.deep/memory.json
grep compaction ~/.deep/dsh-home/profiles/web/cordis.patch.yml
```
