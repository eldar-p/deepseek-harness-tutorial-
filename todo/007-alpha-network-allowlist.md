# 007 — Network allowlist

**Status:** 🔄 in progress  
**Priority:** P2  
**ADR:** [0007-guest-network-env-policy](../adr/0007-guest-network-env-policy.md)

## Goal

Preset `balanced`: guest egress policy documented + env at start.

## Checklist

- [x] `resolveAllowlist()` + manifest `allowlists.json`
- [x] `DEEP_NET_MODE` / `DEEP_NET_ALLOWLIST` in guest container
- [x] Log line at `deep start`
- [x] Tests `test/guest-net.test.js`
- [ ] Hard enforcement (proxy sidecar) — beta

## Verify

```bash
npm test -- test/guest-net.test.js
deep start --cpu   # see [INFO] Guest net: ...
docker exec deep-guest-default printenv DEEP_NET_ALLOWLIST
```
