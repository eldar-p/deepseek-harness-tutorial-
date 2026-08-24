# Deep CLI — 1.0 Release

**Version:** `1.0.0`  
**License:** [CC BY-NC-SA 4.0](./LICENSE) — non-commercial; attribution + share-alike

```powershell
node bin/deep.js doctor --readiness --stage=1.0
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
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
npm link

# Or from Release zip (after upload)
node bin/deep.js update --channel beta
```

## Trust

- Artifact sha256 pinned in `manifests/cli-releases.json`
- Pack emits `deep-cli-*.zip.sha256` sidecar
- GPG/cosign signing: optional future hardening (hex pin is the 1.0 trust path)

See [CORE.md](./CORE.md) · [RC.md](./RC.md) · [CHANGELOG.md](./CHANGELOG.md)
