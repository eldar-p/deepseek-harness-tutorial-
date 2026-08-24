# Agent harness test pack

Offline checks for GIM CLI **guardrails + hybrid API wiring** — no Docker, no GGUF, no API key.

## Run

```bash
npm run test:harness
gim test harness
node scripts/harness-test-pack.mjs
node scripts/harness-test-pack.mjs --json
```

## Scenarios

| ID | What |
|----|------|
| `policy-score` | Isolation posture ≥90% (jail, allowlist, risk, egress, secrets) |
| `jail-inside` / `jail-escape` | Workspace jail path containment |
| `risk-rm` / `risk-ls` | Bash auto-mode heuristic |
| `risk-env` / `risk-src` | Write-path secret deny |
| `tool-search` | Deferred tool catalog |
| `mcp-tool-search` | In-process MCP `tool_search` |
| `api-yaml` | Cloud provider → DSH yaml |
| `smoke-api` | `npm run smoke:api` mock exit 0 |

## Related (need Docker / live stack)

| Command | Needs |
|---------|--------|
| `npm run smoke:guest` | Docker |
| `npm run smoke:e2e` | Full stack |
| `npm test` / `npm run test:coverage` | Unit + coverage gate |
| `GIM_API_SMOKE=1 npm run smoke:api` | Real API key |

## Policy score

```bash
gim doctor --policy
gim doctor --security   # policy + P6 enforcement eval
# or included in: gim doctor --readiness --stage=1.1
```

## Security eval (P6)

```bash
npm run test:security
gim test security
```

See [SECURITY-EVAL.md](./SECURITY-EVAL.md) — adversarial enforcement, separate from this harness pack.

See [docs/SECURITY-EVAL.md](./SECURITY-EVAL.md) — adversarial enforcement pack.
