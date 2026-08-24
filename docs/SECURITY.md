# GIM security posture

What we protect, how we verify it, and what we **do not** promise.

## Levels of claim

| Level | User-facing phrase | Requirements |
|-------|-------------------|--------------|
| **Hardened** | Isolation and guardrails by default | Audits 1–32 + `test:security` + threat model |
| **Assured** | Tested against OWASP LLM agent threats | + egress runtime smoke + published residual risks |
| **Certified** | Enterprise-ready | External audit, SOC 2, IR plan — **not current** |

GIM targets **Assured** (partial) at 2.0 — Hardened controls + runtime egress smoke + published residual risks in [RELEASE.md](../RELEASE.md).

## Controls (summary)

- **Workspace jail** — FS tools bounded to stack workspace ([ADR 0005](../adr/0005-workspace-jail-for-fs-tools.md)).
- **Guest-only bash** — no host `pwsh`/`bash` tool for the agent.
- **Risk classifier** — heuristic deny for destructive commands; optional LLM confirm path.
- **Network presets** — allowlist / offline / open (open = explicit WARN).
- **Supply chain pins** — sha256 on release artifacts; zero runtime npm deps.
- **Logging policy** — event-only host log; no prompt bodies in `gim.log`.

## Verify locally

```bash
npm run audit:security      # static checks 1–32
npm run test:security       # P6 adversarial enforcement pack
npm run smoke:egress        # runtime: offline guest blocks egress (Docker)
gim doctor --policy         # isolation posture score
gim doctor --security       # policy + security eval summary
gim doctor --release        # pre-tag gate (RC + audits + security eval)
```

Functional agent quality is separate:

```bash
gim start   # warm stack + UI
GIM_UI=http://127.0.0.1:<port> node scripts/honest-eval.mjs
npm run test:honest   # CI wrapper — skips if UI down (nightly)
```

## What we do not claim

- Immunity to prompt injection (see [THREAT-MODEL.md](./THREAT-MODEL.md)).
- Zero trust — the agent has agency inside the sandbox.
- Safe on `network=open` without user awareness.
- That the model never makes mistakes — enforcement blocks **tools**, not bad advice.

## Reporting issues

Security-sensitive bugs: open a private report to maintainers (no public exploit details in issues until fixed).

Related: [OWASP-LLM-MAP.md](./OWASP-LLM-MAP.md) · [PRINCIPLES.md](./PRINCIPLES.md) (§5 honest limits)
