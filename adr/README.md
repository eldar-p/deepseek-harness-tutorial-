# Architecture Decision Records (ADR)

Краткие решения по Deep CLI. Формат: контекст → решение → последствия.

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-local-stack-composition.md) | Локальный стек: llama + guest + DSH | Accepted |
| [0002](./0002-guest-container-over-virtualbox.md) | Guest = Docker, не VirtualBox | Accepted |
| [0003](./0003-manifest-pin-and-sha256.md) | Manifests + sha256 pin | Accepted |
| [0004](./0004-docker-engine-path-on-windows.md) | `engineEnv()` PATH на Windows | Accepted |
| [0005](./0005-workspace-jail-for-fs-tools.md) | Workspace jail для FS tools | Accepted |
| [0006](./0006-context-layers-and-memory.md) | Слои контекста и memory.json | Accepted |
| [0007](./0007-guest-network-env-policy.md) | Guest network policy via env | Accepted |
| [0008](./0008-license-cc-by-nc-sa-4.0.md) | License CC BY-NC-SA 4.0 | Accepted |

## Шаблон нового ADR

```markdown
# NNN — Title

**Status:** Proposed | Accepted | Superseded  
**Date:** YYYY-MM-DD

## Context
…

## Decision
…

## Consequences
…
```

Задачи по внедрению: [../todo/README.md](../todo/README.md)
