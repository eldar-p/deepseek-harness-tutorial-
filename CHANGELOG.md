# Changelog

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
