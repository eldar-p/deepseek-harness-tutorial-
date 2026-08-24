# Changelog

## [1.1.1] — 2026-08-24

### Fixed

- `lsp-bridge` DSH plugin: use `defineTool` + `ctx.tools.register` (was crashing boot with `ctx.tool` / missing `output.render`)
- Channel revisions in `manifests/channels.json` aligned to **1.1**

### Added

- WSL field-lite runner `scripts/run-wsl-field-lite.sh` (LF); Linux WSL field-lite **10/10 PASS**
- Windows full-stack re-verified: Engine/Guest/Llama/DSH **GREEN**, `smoke:e2e` PASS

## [1.1.0] — 2026-08-24

### Added

- `deep coord --task=…` — parallel index-search coordinator
- `deep mcp config` — Cursor/Claude Desktop MCP JSON snippet
- `npm run smoke:api` — mock (or live) API provider smoke
- Write-path risk: `deep risk write-path` + one-shot-guard deny for `.env`/keys/`secrets.json`
- Readiness stage `1.1` (`deep doctor --readiness --stage=1.1`)
- Agent harness test pack: `deep test harness` / `npm run test:harness` + [docs/HARNESS-TEST-PACK.md](./docs/HARNESS-TEST-PACK.md)
- Policy score: `deep doctor --policy` (isolation grade A–F)
- CI runs `smoke:api` + harness pack on all OS
- GitHub Release **v1.1.0** zip + sha256; `manifests/cli-releases.json` channels → 1.1.0
- Cross-OS field-lite: `deep field lite` + `field-linux.sh` / `field-macos.sh` / WSL helper; CI job on ubuntu+macos
- Readiness `--stage=field` for OS parity assets

### Changed

- Version **1.1.0** (post-1.0 hybrid/MCP/auto-mode track)

## [1.0.1] — 2026-08-24

### Added

- Hybrid cloud mode: `deep bootstrap|start --api PROVIDER` (openai/deepseek/openrouter/groq/together/custom)
- Semantic code index: `deep index build|search|status` + optional LanceDB
- Host egress proxy + `secrets.json` (never mounted into guest)
- MCP stdio server: `scripts/deep-mcp.mjs`
- LSP bridge: `deep lsp` + `dsh-plugins/lsp-bridge` + skill
- Coordinator: `scripts/coordinator.mjs` (parallel index workers)
- Memory/CONTEXT budget checks in `bootstrap` / `doctor`
- Auto-mode LLM classifier: `deep risk classify` + `DEEP_AUTO_MODE=llm` (heuristic first; LLM only on `confirm`)
- Stack health daemon: `deep daemon start|stop|status|tick` (Kairos-lite)
- Proactive nudge: `.deep/PROACTIVE.md` on unhealthy ticks (`DEEP_PROACTIVE=1` / `--proactive`)
- ToolSearch deferred catalog: `src/tool-search.js` + MCP `tool_search` / `tool_select`
- `deep mcp` stdio server (index + stack + risk + daemon tools)
- Linux GPU: pinned **Vulkan** llama binary (official ggml has no Linux CUDA zip)
- Beginner guide `README_BEGINNER.md`, `docs/OS-COMPAT.md`
- ASCII banner (`assets/banner.txt`) on `help` / `start` / first run
- `deep version` — local vs CDN freshness
- `deep deps` / `deep check` — dependency + version probe
- `deep help [command]` topic help
- `DEEP_NO_BANNER=1` to silence art
- Pinned llama.cpp sha256 for win32 / linux / darwin (b9771)

### Changed

- Coverage gate **80%** (CI floor 78% for OS branch skew)
- Product positioning: hybrid local GGUF **or** cloud API (not local-only)

## [1.0.0] — 2026-08-24

### Added

- `doctor --readiness --stage=1.0` (V1_MILESTONES)
- `RELEASE.md` product page
- Update-from-zip install test; CLI status/bootstrap/stop coverage; startDsh miss path

### Changed

- Coverage gate **80%** (src ~83%)
- Version **1.0.0**

## [0.5.0] — 2026-08-24

### Added

- Windows field sign-off (Engine/Guest/Llama/DSH GREEN)
- `doctor --stage=0.5` / CORE_MILESTONES (100/100)
- `CORE.md`; tests for waitHttpOk, extractArchive, spawnDetached, ensureGuestImage, GGUF cache

### Changed

- Coverage gate **75%** (src ~79%)
- Version **0.5.0** (core freeze)

## [0.9.0-rc.0] — 2026-08-24

### Added

- `doctor --readiness --stage=rc` (RC_MILESTONES, 100/100)
- `RC.md` + field matrix checklist
- CLI tests: doctor/stacks/status/stop/bootstrap missing gguf
- Detect/download tests: engineEnv, hostSummary, ensureCachedAsset cache hit

### Changed

- Coverage gate **70%** (src ~76%)
- Version **0.9.0-rc.0**

## [0.4.0-beta] — 2026-08-24

### Added

- Unit tests: gpu-lock, dsh settings/status, status-ui screen, update dry-run
- Coverage gate raised to **60%** (src ~73%)

### Changed

- Version bump to **0.4.0-beta** (field beta)

## [0.3.0-prebeta] — 2026-08-24

### Added

- `src/checksums.js` + pack-release `.sha256` sidecar
- `deep update` verifies sidecar / optional `sha256Url`
- Unit tests: `parseArgs`, help/presets, checksums
- Nightly CI workflow (ubuntu / macos / windows)

### Changed

- Version bump to **0.3.0-prebeta** (pre-beta gate closed)

## [0.2.0-alpha] — 2026-08-24

### Added

- `todo/` — alpha backlog (001–009)
- `adr/` — architecture decision records (0001–0007)
- `src/workspace-jail.js` + FS jail wired in cordis patch
- `assets/memory.template.json` seeded at bootstrap
- `scripts/smoke-guest.mjs` + CI job `smoke-guest` (ubuntu)
- `scripts/smoke-e2e.mjs` + `npm run smoke:e2e` (jail/HTTP/guest/chat)
- Coverage gate raised to **30%** (src ~69%)
- `npm run audit:alpha`
- `deep doctor --readiness --stage=alpha`
- `deep stacks`, `deep status --all`, `registerStack()` in config
- Guest network env: `DEEP_NET_MODE`, `DEEP_NET_ALLOWLIST`
- GPU lock tracks stack name; blocks second GPU stack
- `ALPHA.md` status page

### Changed

- **License:** MIT → **CC BY-NC-SA 4.0** (Attribution-NonCommercial-ShareAlike)
- README rewritten for Deep CLI alpha (legacy VirtualBox moved to bottom)
- Coverage gate raised to **50%** (src ~69%)
- Audit #18 TTY → PASS; Audit #22 context → PASS
- Guest image `deep-guest:0.2-beta` with iptables allowlist (`deep-net-enforce`)
- `deep update --dry-run` + CDN fetch path when artifact URLs set
- `npm run pack:release` packs `dist/deep-cli-*.zip` with sha256 snippet
- `deep update --channel beta` extracts zip + writes `%LOCALAPPDATA%\deep\bin\deep.cmd`
- Local override: `DEEP_CLI_ZIP` / `DEEP_CLI_SHA256`
### Changed

- Pre-beta: audits #5/#7 PASS; `docs/TYPES.md`; `npm run audit:prebeta`
- Tests: proc / llama / shutdown (74 total)
- GitHub Release `v0.2.0-alpha` includes `deep-cli-0.2.0-alpha.zip` (CDN install verified)
- `deep doctor --readiness --stage=beta` (100/100)
- `BETA.md` / `PRE-BETA.md` status pages

## [0.1.0-prealpha] — 2026-08-24

### Added

- Deep CLI: `doctor`, `bootstrap`, `start`, `stop`, `status`, `presets`, `update`, `help`
- `doctor --readiness` — 10-item pre-alpha milestone score
- llama-server fetch (sha256), spawn, health yellow→green, quant warnings
- DSH web spawn, settings → local llama, plugin/skill materialize
- Guest container: `Dockerfile.guest`, build/run, mount smoke test
- DSH plugins: `guest-bash-local`, `workspace-jail-fs`; cordis patch preset
- 31 unit tests, 26 audits, CI (ubuntu/macos/windows), infra docs + LICENSE
- Windows Docker Desktop path detection + `engineEnv()` PATH fix for credential helper

### Verified

- Full stack GREEN on Windows: engine + guest + llama + DSH
- Pre-alpha readiness: **100/100**
