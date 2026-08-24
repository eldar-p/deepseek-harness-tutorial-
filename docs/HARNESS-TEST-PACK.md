# Agent harness test pack

Offline checks for Deep CLI **guardrails + hybrid API wiring** — no Docker, no GGUF, no API key.

## Run

```bash
npm run test:harness
deep test harness
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
| `DEEP_API_SMOKE=1 npm run smoke:api` | Real API key |

## Policy score

```bash
deep doctor --policy
# or included in: deep doctor --readiness --stage=1.1
```

See [MARKET-FIT.md](./MARKET-FIT.md) — this pack moves **AI testing** from partial toward cover for authors of the stack.
