# Changelog

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
