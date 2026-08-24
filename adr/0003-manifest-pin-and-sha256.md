# 0003 — Manifest pin and sha256 verify

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Бинарники llama.cpp и ассеты должны быть воспроизводимы и проверяемы.

## Decision

Каталог `manifests/` с JSON pins:

- `llama-binaries.json` — CPU/CUDA builds, URL + sha256
- `guest-images.json`, `dsh-pin.json`, `cli-releases.json`, …

Download → cache в `~/.gim/manifests-cache/` → sha256 verify перед использованием.

Pre-alpha: git install only; CDN publish — beta+.

## Consequences

- Offline repeat installs используют cache
- Bump build = edit manifest + re-verify
- Audit #8 deps / #14 cdn отслеживают зрелость канала
