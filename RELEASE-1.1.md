# Deep CLI — 1.1 Release

**Version:** `1.1.0`  
**License:** [CC BY-NC-SA 4.0](./LICENSE) — non-commercial; attribution + share-alike

```powershell
node bin/deep.js doctor --readiness --stage=1.1
npm test
npm run test:coverage   # ≥80% (CI floor 78)
npm run smoke:api       # mock; live: $env:DEEP_API_SMOKE=1
```

## What’s new since 1.0

| Capability | Status |
|------------|--------|
| Hybrid `--api` cloud providers | ✅ |
| Semantic index + MCP `code_search` / `tool_search` | ✅ |
| Auto-mode heuristic + optional LLM | ✅ |
| `deep daemon` + proactive `.deep/PROACTIVE.md` | ✅ |
| `deep coord` parallel workers | ✅ |
| Linux Vulkan GPU pin (no official CUDA zip) | ✅ |
| Write-path secret deny | ✅ |

## Install

```powershell
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
npm link
deep doctor --readiness --stage=1.1
```

MCP in Cursor: `deep mcp config`

See [CHANGELOG.md](./CHANGELOG.md) · [RELEASE.md](./RELEASE.md) (1.0 baseline) · [docs/CLAUDE-CODE-LEAK-TRIAGE.md](./docs/CLAUDE-CODE-LEAK-TRIAGE.md)
