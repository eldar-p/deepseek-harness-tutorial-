# 007 — Network allowlist

**Status:** ⏳ pending  
**Priority:** P2  
**ADR:** —

## Goal

Preset `balanced`: guest egress только по `manifests/allowlists.json` (proxy sidecar или iptables — TBD).

## Checklist

- [ ] Спецификация allowlist enforcement
- [ ] `guestNetworkArgs` + smoke с `--network none` vs bridge
- [ ] Audit #10 container / #11 isolation green
