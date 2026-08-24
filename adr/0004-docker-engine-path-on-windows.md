# 0004 — Docker engine PATH on Windows

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Docker Desktop на Windows кладёт `docker.exe` и `docker-credential-desktop` в  
`%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\`, не в default `Program Files`.

Node `spawnSync('docker')` без этого PATH падает:

```text
docker-credential-desktop: executable file not found in %PATH%
```

## Decision

1. `resolveEngineBin()` — ищет docker в PATH, `GIM_DOCKER_BIN`, и DockerDesktop bin dir
2. `engineEnv(bin)` — prepend bin directory к PATH для **всех** docker spawns
3. `doctor` подсказка + `scripts/wait-docker.ps1`

## Consequences

- Guest build/run работает из Cursor/Node без ручного PATH
- Legacy install path `Program Files\Docker\...` остаётся fallback
- Podman: тот же паттерн если credential helper рядом с binary
