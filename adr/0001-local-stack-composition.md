# 0001 — Local stack composition

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Нужен локальный агентный стек без облака: inference, sandbox shell, web UI.

## Decision

**Deep CLI** на хосте (Node 22+) оркестрирует три процесса:

1. **llama-server** — OpenAI-compatible API на `127.0.0.1`
2. **deep-guest** — контейнер с bash-only shell
3. **DSH web** — UI + tools, модель → llama, shell → guest

Один stack = один набор портов + workspace + guest container.

## Consequences

- Простая mental model; multi-stack позже (`--name`)
- DSH и llama на хосте — меньше latency, больше attack surface (mitigate jail + guest-only bash)
- Legacy VirtualBox tutorial остаётся отдельным треком в репо
