# GIM threat model

Trust boundaries and assets for the local agent harness. This is the canonical reference for security claims — not marketing copy.

## Assets

| Asset | Location | Sensitivity |
|-------|----------|-------------|
| Host filesystem (outside workspace) | User machine | High |
| Workspace project files | `~/.gim/workspace/<stack>/` | Medium–High |
| Secrets (`.env`, keys) | Workspace / host | Critical |
| API keys (cloud `--api`) | `~/.gim/dsh-home`, env | Critical |
| LLM weights / Colibri cache | Model dir, `~/.gim/cache/llm/` | Medium |
| Chat history | `~/.gim/chats/` | Medium |
| GIM config / run state | `~/.gim/config.json`, `run/` | Medium |

## Trust boundaries

```text
┌─────────────────────────────────────────────────────────────┐
│ HOST (GIM CLI + UI on 127.0.0.1)                            │
│  • agent-tools (FS jail, risk classifier)                   │
│  • NO host shell tool for agent                             │
│  • paths.js — logs events only, not prompt bodies           │
└───────────────┬─────────────────────────┬───────────────────┘
                │ docker exec              │ HTTP /v1
                ▼                          ▼
┌───────────────────────────┐   ┌────────────────────────────┐
│ GUEST (gim-guest-<stack>) │   │ LLM (Colibri/vLLM/GGUF)    │
│  • bash only in container │   │  • untrusted text gen      │
│  • /workspace mount only  │   │  • prompt injection vector │
│  • egress: allowlist/open │   │  • not a security boundary │
└───────────────────────────┘   └────────────────────────────┘
```

## Threat actors

1. **Malicious user prompt** — tries to exfiltrate, destroy, or pivot.
2. **Indirect prompt injection** — poisoned file in workspace (STRUCTURE, README, dependency).
3. **Compromised model output** — tool calls that bypass intent but must hit enforcement.
4. **Supply chain** — tampered update zip, guest image, or model weights.
5. **Network egress** — guest or API path calling attacker endpoints.

## Security invariants (must hold)

These are verified by `npm run test:security` and static audits 1–32:

1. Agent has **no host shell** — only `guest_bash` in Docker.
2. FS tools **cannot escape workspace** (`../`, absolute paths → deny).
3. **Destructive bash** (`rm -rf`, `curl|bash`, force push) → deny before exec.
4. **Secret paths** (`.env`, `id_rsa`, `.git/`) → write deny.
5. Guest container: **workspace mount only** — no `docker.sock`, no `--privileged`.
6. Default network is **not silent open** — `open` preset logs WARN.
7. Updates require **sha256 match** (audit #32).

## Prompt injection — explicit non-claim

> Prompt injection can make the model **attempt** harmful tool calls.  
> GIM does **not** treat the model as trusted. Enforcement (jail, risk deny, guest boundary) is the control.

We **mitigate** injection via tool enforcement; we do **not** claim immunity.

## Residual risks (honest)

| Risk | Mitigation today | Gap |
|------|------------------|-----|
| Model reads workspace `.env` | Write deny; read allowed in workspace | User must not commit secrets to workspace |
| `open` network preset | WARN in logs | Full egress if user opts in |
| Guest with NET_ADMIN | Needed for allowlist iptables | Misconfigured allowlist → broader egress |
| Cloud `--api` mode | Keys in env; no guest required | Data leaves machine to provider |
| Model hallucination / wrong edits | User review; ask_user | Not a security control |
| 512K context / DoS | compact, queue limits | Low RAM → OOM, not auth bypass |

## Verification pyramid

| Level | Artifact |
|-------|----------|
| L1 Static audits | `npm run audit:prebeta`, `npm run audit:security` |
| L2 Unit tests | `test/jail.test.js`, `test/config-security.test.js` |
| L3 **Security eval (P6)** | `npm run test:security` — enforcement scenarios |
| L4 Docker egress smoke | `npm run smoke:guest` (planned runtime verify) |
| L5 External pentest | Not done |

**Claim «security-hardened»:** L1–L3 PASS + this document + [OWASP-LLM-MAP.md](./OWASP-LLM-MAP.md).

See also: [SECURITY.md](./SECURITY.md) · [SECURITY-EVAL.md](./SECURITY-EVAL.md) · [SECURITY-AUDITS-EXTRA.md](./SECURITY-AUDITS-EXTRA.md)
