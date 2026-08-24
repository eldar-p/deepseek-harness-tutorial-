# Deep CLI — TODO (Beta / Pre-beta)

После **alpha complete** (`v0.2.0-alpha`). План версий: [../docs/VERSION-PLAN.md](../docs/VERSION-PLAN.md)

| ID | Задача | Статус | Этап |
|----|--------|--------|------|
| [010](./010-beta-hard-egress.md) | Hard egress proxy / DNS filter | ✅ done | beta |
| [011](./011-beta-context-audit.md) | Audit #22 compact/prune enforcement | ✅ done | pre-beta |
| [012](./012-beta-coverage-50.md) | Coverage ≥50% | ✅ done | pre-beta |
| [013](./013-beta-cdn-artifacts.md) | CDN artifacts + install from channel | ✅ done | beta |
| [014](./014-beta-tty-polish.md) | TTY / audit #18 WARN → PASS | ✅ done | beta |
| [015](./015-prebeta-full-audit.md) | Audit gate pre-beta (all 26) | ✅ done | pre-beta |
| [016](./016-prebeta-coverage-cli.md) | More tests for cli/llama/guest | ✅ done | pre-beta |
| [017](./017-checksum-sidecars.md) | Zip `.sha256` sidecar + verify | ✅ done | field beta |
| [018](./018-cli-parseargs-tests.md) | parseArgs / help / presets tests | ✅ done | field beta |
| [019](./019-field-gpu-dsh-tests.md) | gpu-lock + dsh + status-ui tests | ✅ done | field beta |
| [020](./020-field-coverage-60.md) | Coverage gate ≥60% | ✅ done | field beta |
| [021](./021-rc-readiness.md) | RC readiness + more CLI tests | ✅ done | RC |
| [022](./022-core-05.md) | 0.5 core + Windows field | ✅ done | 0.5 |
| [023](./023-v1-release.md) | Ship 1.0.0 | ✅ done | 1.0 |
| [024](./024-automode-daemon.md) | Auto-mode LLM + daemon | ✅ done | post-1.0 |
| [025](./025-toolsearch-mcp-vulkan.md) | ToolSearch + MCP + Vulkan | ✅ done | post-1.0 |
| [026](./026-ship-1.1.md) | Ship 1.1.0 | ✅ done | 1.1 |
| [027](./027-harness-policy.md) | Harness pack + policy score | ✅ done | 1.1 |
| [028](./028-field-parity.md) | Linux/macOS field-lite | ✅ done | 1.1 |

**1.1.1** — lsp-bridge boot fix · WSL field-lite GREEN · Windows e2e GREEN  
Readiness: `deep doctor --readiness --stage=1.1|field` · Policy: `deep doctor --policy` · [OS-COMPAT.md](../docs/OS-COMPAT.md)

Alpha archive: [README.md](./README.md)
