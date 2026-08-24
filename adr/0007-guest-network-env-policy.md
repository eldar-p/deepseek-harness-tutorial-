# 0007 — Guest network policy via env + iptables

**Status:** Accepted (updated)  
**Date:** 2026-08-24

## Context

Presets `balanced` and `dev` need egress control. Env-only was alpha; beta adds in-guest iptables.

## Decision

1. At `docker run`, inject `DEEP_NET_MODE` + `DEEP_NET_ALLOWLIST`
2. Guest image `deep-guest:0.2-beta` ENTRYPOINT `deep-net-enforce`:
   - resolve allowlist domains → IPv4
   - `OUTPUT DROP` + allow DNS/loopback/established + allowlisted IPs
3. Host adds `--cap-add NET_ADMIN` (except offline/`--network none`)
4. Failures are non-fatal (log WARN, keep container up)

## Consequences

- Harder egress than env-only; DNS/CDN IP churn may need restart to refresh rules
- IPv6 not filtered yet
- CDN publish of guest image digest still open
