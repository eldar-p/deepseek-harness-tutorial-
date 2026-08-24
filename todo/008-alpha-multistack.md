# 008 — Multi-stack

**Status:** ✅ done  
**Priority:** P2

## Goal

Несколько независимых стеков: `deep start --name dev`, отдельные порты/workspace/guest.

## Checklist

- [x] CLI `--name` on start/stop/status/bootstrap
- [x] `deep stacks` + `deep status --all`
- [x] `registerStack()` in config.json
- [x] GPU lock per stack name (`gpu-lock.js`)
- [x] Tests runstate summarizeStacks

## Verify

```bash
deep start --name dev --cpu
deep stacks
deep status --all
deep stop --name dev
```
