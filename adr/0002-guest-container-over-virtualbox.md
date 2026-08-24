# 0002 — Guest container over VirtualBox

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Legacy tutorial использовал Debian VM (VirtualBox + SSH). Deep CLI — новый продуктовый трек.

## Decision

Guest для Deep CLI — **Docker/Podman контейнер** (`Dockerfile.guest`, образ `deep-guest:prealpha`):

- Mount workspace → `/workspace`
- `docker exec` для bash (plugin `guest-bash-local`)
- Smoke: touch file in container → visible on host

VirtualBox path (`vm-bash-local`, `host/`) не удаляем — legacy only.

## Consequences

- Требует Docker Desktop на Windows (PATH/credential quirks — см. ADR-0004)
- Быстрее cold start vs full VM
- CI smoke возможен на ubuntu runner с Docker
