# GIM CLI — 1.0 Release

**Version:** `1.0.0`  
**License:** [Apache-2.0](./LICENSE) — non-commercial; attribution + share-alike

```powershell
node bin/gim.js doctor --readiness --stage=1.0
npm test
npm run test:coverage   # ≥80%
npm run audit:prebeta
```

## Product

Local stack orchestrator: **llama.cpp** + **Docker guest** + **DSH**.

| Capability | Status |
|------------|--------|
| `doctor` / `bootstrap` / `start` / `stop` / `status` / `stacks` / `update` / `presets` | ✅ |
| Multi-stack + GPU lock | ✅ |
| Guest iptables allowlist | ✅ |
| Workspace jail | ✅ |
| CDN zip + sha256 sidecar + install shim | ✅ (upload needs `gh auth`) |
| Windows field GREEN | ✅ |
| Coverage gate | ✅ ≥80% (~83%) |

## Install / update

```powershell
# From git
git clone https://github.com/eldar-p/gim-cli.git
cd gim-cli
npm link

# Or from Release zip (after upload)
node bin/gim.js update --channel beta
```

## Trust

- Artifact sha256 pinned in `manifests/cli-releases.json`
- Pack emits `gim-cli-*.zip.sha256` sidecar
- GPG/cosign signing: optional future hardening (hex pin is the 1.0 trust path)

See [ALPHA.md](./ALPHA.md) · [docs/OS-COMPAT.md](./docs/OS-COMPAT.md) · [CHANGELOG.md](./CHANGELOG.md)
