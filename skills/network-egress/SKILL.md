---
name: network-egress
description: Guest outbound HTTP — network presets (offline/allowlist/open), egress proxy, secrets on host only.
---

# Network egress (guest)

Agent **`guest_bash`** runs in Docker. Outbound network depends on stack **preset**:

| Preset | Egress |
|--------|--------|
| `offline` / `none` | No network — curl to internet **fails** (by design) |
| `allowlist` | Only domains in manifest (iptables + optional proxy) |
| `open` | Full bridge egress — **WARN** logged; user must opt in |
| `dev` | Expanded allowlist for package registries |

Default safe path: **allowlist** or **offline**. Never assume clearnet from guest without checking preset.

## Research / fetch workflow

1. Check preset: `gim status` or start logs (`Guest net: ...`).
2. If **offline**: you cannot fetch URLs from guest — tell user or use host `--api` LLM knowledge only.
3. If **allowlist**: use `guest_bash` curl only to allowed domains; API keys via **egress proxy** (host), not mounted into guest.
4. Secrets live in host `secrets.json` / env — **never** `write_file` real keys into workspace `.env` (write deny).

## Egress proxy (when enabled)

Host runs proxy; guest gets `HTTP_PROXY` pointing at host. Tool catalog id: `egress_proxy`.

```bash
# guest_bash — only when proxy/allowlist permits target
curl -fsS --max-time 30 'https://allowed-registry.example/...'
```

## Do not

- Assume Tor or `tor-up.sh` — not part of default GIM 2.0 stack
- Use cloud `--api` for fetches when user wanted local-only privacy
- Put API keys in workspace files the model can read

See [gim-security](../gim-security/SKILL.md) · [docs/THREAT-MODEL.md](../../docs/THREAT-MODEL.md).
