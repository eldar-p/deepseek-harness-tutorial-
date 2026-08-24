# 010 — Hard egress for guest

**Status:** ✅ done · **Stage:** beta  
**ADR:** [0007](../adr/0007-guest-network-env-policy.md)

## Checklist

- [x] `guest/deep-net-enforce.sh` + Dockerfile ENTRYPOINT
- [x] Image tag `deep-guest:0.2-beta`
- [x] `--cap-add NET_ADMIN` for allowlist presets
- [x] Non-fatal iptables failures
- [ ] IPv6 + CDN IP refresh on TTL (later)
