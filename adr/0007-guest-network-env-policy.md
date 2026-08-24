# 0007 — Guest network policy via env

**Status:** Accepted  
**Date:** 2026-08-24

## Context

Presets `balanced` and `dev` need egress control for package installs (pip/npm/git). Full iptables or sidecar proxy is heavy for alpha.

## Decision

At `docker run`, inject:

- `DEEP_NET_MODE` — preset network mode (`allowlist`, `none`, `open`, …)
- `DEEP_NET_ALLOWLIST` — comma-separated domains from `manifests/allowlists.json`

Offline presets use `--network none`. Allowlist presets use bridge + env (documented policy; enforcement hook in guest toolkit later).

Log line at start: `Guest net: network=allowlist (N domains…)`.

## Consequences

- Alpha: policy visible and testable; not a hard firewall yet
- Beta: guest entrypoint or sidecar reads env and configures proxy/dns
- Audit #11 isolation documents defer for hard enforcement
