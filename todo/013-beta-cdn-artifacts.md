# 013 — CDN artifacts

**Status:** 🔄 in progress · **Stage:** beta

## Checklist

- [x] `pickCliArtifact()` + `deep update --dry-run`
- [x] CDN fetch+sha256 path when `artifacts[].url` set
- [x] Placeholder rows in `cli-releases.json` beta channel
- [x] `npm run pack:release` → zip + sha256 for upload
- [ ] Upload zip to GitHub Release / CDN host
- [ ] Fill real url+sha256 in `cli-releases.json`
- [ ] Auto extract + install into PATH
