# 0002 — Guest container over VirtualBox

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Legacy tutorial использовал Debian VM (VirtualBox + SSH). GIM CLI заменяет это Docker guest.

## Decision

Guest для GIM CLI — **Docker/Podman контейнер** (`Dockerfile.guest`, образ `gim-guest:prealpha`):

- Mount workspace → `/workspace`
- `docker exec` для bash (plugin `guest-bash-local` + host `guest_bash` tool)
- Egress policy via `guest/gim-net-enforce.sh`
- Smoke: touch file in container → visible on host

VirtualBox / `vm-bash-local` / `host/` **удалены** из репозитория (2026-08).

## Consequences

- Требует Docker Desktop на Windows (PATH/credential quirks — см. ADR-0004)
- Быстрее cold start vs full VM
- CI smoke возможен на ubuntu runner с Docker
