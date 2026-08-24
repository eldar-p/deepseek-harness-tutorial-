# 0001 — Local stack composition

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Нужен локальный агентный стек без облака: inference, sandbox shell, web UI.

## Decision

**GIM CLI** на хосте (Node 22+) оркестрирует три процесса:

1. **LLM** — Colibri Docker (default Win/Linux), or llama GGUF / cloud API / vLLM Docker
2. **gim-guest** — контейнер с bash-only shell
3. **GIM UI** — native SPA (SSE agent loop); DSH опционально (`GIM_USE_DSH=1`)

Один stack = один набор портов + workspace + guest container.

## Consequences

- Простая mental model; multi-stack через `--name`
- LLM и UI на хосте — jail + guest-only bash + security eval (P6)
- Legacy VirtualBox tutorial удалён из репо (ADR-0002)
