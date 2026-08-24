# Changelog

## [1.1.2] — 2026-08-24

### Added

- Honest-eval **adversarial suite** (a01–a12) from published agent failures (AIShellJack, Trail of Bits, Oso, Unit42, AgentHopper)
- `src/honest-eval-tasks.js` — task catalog + helpers
- [docs/HONEST-EVAL.md](./docs/HONEST-EVAL.md)
- `gim doctor --release`, `npm run smoke:egress`, `npm run test:honest`
- Skills rework: `gim-workspace`, `gim-security`, `network-egress`; index [skills/README.md](./skills/README.md)
- Tool-search catalog: `doctor_release`, `doctor_security`, `colibri_speed`
- **Incremental code index** — content hashes, Worker cosine search, lazy `status`, touch on `write_file`
- **External MCP client** — `gim mcp client/doctor/tools/resources/prompts/watch`; agent `mcp_list_tools` / `mcp_call` (tools, resources, prompts)
- **AI instructions** — `.gim/ai-instructions.md`, `gim instructions init|refresh|sync`, agent + MCP `project_instructions`
- [docs/CODE-INDEX.md](./docs/CODE-INDEX.md), [docs/ARCHITECTURE-GUIDE.md](./docs/ARCHITECTURE-GUIDE.md), [sidecar/README.md](./sidecar/README.md)

### Changed

- Release gate in CI; coverage ≥80%; adaptive ctx cap (<64 GB RAM → 128K)
- Agent defaults: `GIM_TOOL_MAX_READ` 8 KB; batch tool results on
- Universal Colibri Docker: `--colibri` / `llm: colibri` over `cfg.gguf`; Linux ELF engine preflight; entrypoint CRLF fix
- Context meter includes ai-instructions + MCP servers; capability probe TTL per stack (`GIM_CAP_PROBE_TTL_MS`)
- `gim index build` refreshes ai-instructions when file exists (`GIM_INSTRUCTIONS_ON_INDEX=0` to disable)
- Version **1.1.2** (fixes/tuning release track)

## [2.0.0] — 2026-08-24

### Changed

- **Rebrand:** Deep CLI → **GIM CLI** (Generative Intelligence Manager CLI)
- Package `@gim-cli/gim`, binary `gim`, home `~/.gim`, env `GIM_*`
- License **CC BY-NC-SA 4.0 → Apache-2.0** (commercial-friendly; Colibri orchestration OK — do not vendor Colibri C as package code)
- GitHub repo → `eldar-p/gim-cli`
- Breaking: migrate config from `~/.deep` to `~/.gim` (copy manually if upgrading)

### Added

- **Native GIM UI** (`ui/`, `gim ui`) — chats, Agent/Ask/Plan/Debug, model select, attachments, SSE streaming + thoughts
- DSH is **optional** (`--dsh` / `GIM_USE_DSH=1`); default front-end is GIM UI
- Agent/Debug **tools**: `list_dir`, `read_file`, `write_file`, `search_files`, `guest_bash` (+ risk deny)
- Workspace **file browser** panel in GIM UI
- **ask_user** clarifying polls (options + free text); Ask/Plan can clarify too; UI form resumes the agent loop
- **Colibri backend** (`gim start --colibri`): safetensors via `coli serve`; default `E:\models\DeepSeek-V4-Flash-0731`; wired into GIM UI model list

### Release readiness (2.0.0)

- `gim doctor --release` — RC readiness + audit:prebeta + audit:security + security eval
- `npm run smoke:egress` — runtime egress smoke (offline guest) in CI
- Coverage gate ≥80% with expanded Colibri/llm-docker tests
- Adaptive ctx cap: RAM < 64 GB → 128K unless `GIM_CTX` set
- Agent efficiency: `GIM_TOOL_MAX_READ` default 8 KB; batch tool results on by default
- CI: `test:security` + `audit:security` on all OS; egress smoke on ubuntu
- [RELEASE.md](./RELEASE.md) with published residual risks
- **Skills rework (2.0):** `skills/README.md` — GIM workspace, security, network-egress; removed legacy Tor/DSH/hostshare skills
- `npm run test:honest` — honest-eval CI wrapper (skips if UI down)

## [1.1.1] — 2026-08-24

### Fixed

- `lsp-bridge` DSH plugin: use `defineTool` + `ctx.tools.register` (was crashing boot with `ctx.tool` / missing `output.render`)
- Channel revisions in `manifests/channels.json` aligned to **1.1**

### Added

- WSL field-lite runner `scripts/run-wsl-field-lite.sh` (LF); Linux WSL field-lite **10/10 PASS**
- Windows full-stack re-verified: Engine/Guest/Llama/DSH **GREEN**, `smoke:e2e` PASS

## [1.1.0] — 2026-08-24

### Added

- `gim coord --task=…` — parallel index-search coordinator
- `gim mcp config` — Cursor/Claude Desktop MCP JSON snippet
- `npm run smoke:api` — mock (or live) API provider smoke
- Write-path risk: `gim risk write-path` + one-shot-guard deny for `.env`/keys/`secrets.json`
- Readiness stage `1.1` (`gim doctor --readiness --stage=1.1`)
- Agent harness test pack: `gim test harness` / `npm run test:harness` + [docs/HARNESS-TEST-PACK.md](./docs/HARNESS-TEST-PACK.md)
- Policy score: `gim doctor --policy` (isolation grade A–F)
- CI runs `smoke:api` + harness pack on all OS
- GitHub Release **v1.1.0** zip + sha256; `manifests/cli-releases.json` channels → 1.1.0
- Cross-OS field-lite: `gim field lite` + `field-linux.sh` / `field-macos.sh` / WSL helper; CI job on ubuntu+macos
- Readiness `--stage=field` for OS parity assets

### Changed

- Version **1.1.0** (post-1.0 hybrid/MCP/auto-mode track)

## [1.0.1] — 2026-08-24

### Added

- Hybrid cloud mode: `gim bootstrap|start --api PROVIDER` (openai/deepseek/openrouter/groq/together/custom)
- Semantic code index: `gim index build|search|status` + optional LanceDB
- Host egress proxy + `secrets.json` (never mounted into guest)
- MCP stdio server: `scripts/gim-mcp.mjs`
- LSP bridge: `gim lsp` + `dsh-plugins/lsp-bridge` + skill
- Coordinator: `scripts/coordinator.mjs` (parallel index workers)
- Memory/CONTEXT budget checks in `bootstrap` / `doctor`
- Auto-mode LLM classifier: `gim risk classify` + `GIM_AUTO_MODE=llm` (heuristic first; LLM only on `confirm`)
- Stack health daemon: `gim daemon start|stop|status|tick` (Kairos-lite)
- Proactive nudge: `.gim/PROACTIVE.md` on unhealthy ticks (`GIM_PROACTIVE=1` / `--proactive`)
- ToolSearch deferred catalog: `src/tool-search.js` + MCP `tool_search` / `tool_select`
- `gim mcp` stdio server (index + stack + risk + daemon tools)
- Linux GPU: pinned **Vulkan** llama binary (official ggml has no Linux CUDA zip)
- Beginner guide `README_BEGINNER.md`, `docs/OS-COMPAT.md`
- ASCII banner (`assets/banner.txt`) on `help` / `start` / first run
- `gim version` — local vs CDN freshness
- `gim deps` / `gim check` — dependency + version probe
- `gim help [command]` topic help
- `GIM_NO_BANNER=1` to silence art
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
- `gim update` verifies sidecar / optional `sha256Url`
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
- `gim doctor --readiness --stage=alpha`
- `gim stacks`, `gim status --all`, `registerStack()` in config
- Guest network env: `GIM_NET_MODE`, `GIM_NET_ALLOWLIST`
- GPU lock tracks stack name; blocks second GPU stack
- `ALPHA.md` status page

### Changed

- **License:** MIT → **Apache-2.0** (Attribution-NonCommercial-ShareAlike)
- README rewritten for GIM CLI alpha (legacy VirtualBox moved to bottom)
- Coverage gate raised to **50%** (src ~69%)
- Audit #18 TTY → PASS; Audit #22 context → PASS
- Guest image `gim-guest:0.2-beta` with iptables allowlist (`gim-net-enforce`)
- `gim update --dry-run` + CDN fetch path when artifact URLs set
- `npm run pack:release` packs `dist/gim-cli-*.zip` with sha256 snippet
- `gim update --channel beta` extracts zip + writes `%LOCALAPPDATA%\gim\bin\gim.cmd`
- Local override: `GIM_CLI_ZIP` / `GIM_CLI_SHA256`
### Changed

- Pre-beta: audits #5/#7 PASS; `docs/TYPES.md`; `npm run audit:prebeta`
- Tests: proc / llama / shutdown (74 total)
- GitHub Release `v0.2.0-alpha` includes `gim-cli-0.2.0-alpha.zip` (CDN install verified)
- `gim doctor --readiness --stage=beta` (100/100)
- `BETA.md` / `PRE-BETA.md` status pages

## [0.1.0-prealpha] — 2026-08-24

### Added

- GIM CLI: `doctor`, `bootstrap`, `start`, `stop`, `status`, `presets`, `update`, `help`
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
