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

**Pre-beta** (`0.3.0-prebeta`) — code gate closed · CDN still points at `v0.2.0-alpha` zip until retag  
**Field beta next:** nightly matrix, re-pack + upload `v0.3.0-prebeta`, ≥60% coverage  
Readiness: `deep doctor --readiness --stage=beta` · [BETA.md](../BETA.md) · [PRE-BETA.md](../PRE-BETA.md)

Alpha archive: [README.md](./README.md)
