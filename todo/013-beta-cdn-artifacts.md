# 013 — CDN artifacts

**Status:** ✅ done (local/CDN path) · **Stage:** beta

## Checklist

- [x] `pickCliArtifact()` + `deep update --dry-run`
- [x] CDN fetch+sha256 when `artifacts[].url` set
- [x] `cli-releases.json` beta entries with url+sha256
- [x] `npm run pack:release` → zip + sha256
- [x] Extract + install shim (`src/cli-install.js`)
- [x] Local test: `DEEP_CLI_ZIP=dist/...` + `deep update --channel beta`
- [x] `scripts/publish-release.ps1` (needs `gh auth`)
- [ ] Maintainer: run publish-release.ps1 to upload zip to GitHub Release

## Verify

```powershell
npm run pack:release
$env:DEEP_CLI_ZIP = (Resolve-Path .\dist\deep-cli-0.2.0-alpha.zip).Path
$env:DEEP_CLI_SHA256 = "<sha from pack>"
node bin/deep.js update --channel beta
# After gh upload:
node bin/deep.js update --channel beta   # without DEEP_CLI_ZIP
```
