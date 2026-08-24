# Deep CLI — Beta track

**Стадия:** field beta `0.4.0-beta` on `main` · license [CC BY-NC-SA 4.0](./LICENSE)  
**Tag:** `v0.4.0-beta` (upload zip after `gh auth login`)

```powershell
node bin/deep.js doctor --readiness --stage=beta
node bin/deep.js update --channel beta --dry-run
```

## Что вошло

| Область | Статус |
|---------|--------|
| Hard egress (iptables allowlist) | ✅ `deep-guest:0.2-beta` |
| Audit #22 / #18 | ✅ PASS |
| Coverage ≥60% | ✅ ~73% (gate 60) |
| CDN zip + sha256 sidecar + shim | ✅ pack path; Release upload needs gh auth |
| Nightly 3-OS | ✅ `.github/workflows/nightly.yml` |
| License CC BY-NC-SA 4.0 | ✅ |

Трекер: [todo/README-beta.md](./todo/README-beta.md) · Pre-beta: [PRE-BETA.md](./PRE-BETA.md)

## CDN install

```powershell
node bin/deep.js update --channel beta
# shim → %LOCALAPPDATA%\deep\bin
```

Локальный zip:

```powershell
npm run pack:release
$env:DEEP_CLI_ZIP = (Resolve-Path .\dist\deep-cli-0.4.0-beta.zip).Path
node bin/deep.js update --channel beta
```
