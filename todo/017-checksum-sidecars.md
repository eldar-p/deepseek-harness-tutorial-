# 017 — Checksum sidecars for CDN zip

**Этап:** field beta / pre-beta polish  
**Статус:** ✅ done

## Goal

Release zip ships with `.sha256` sidecar; `deep update` verifies manifest hash and optional sidecar / `sha256Url`.

## Done

- `src/checksums.js` — `sha256File`, `writeSha256Sidecar`, `verifySha256`
- `scripts/pack-release.mjs` writes `deep-cli-*.zip.sha256`
- `src/update.js` verifies local zip via sidecar or expected hex; optional `sha256Url` fetch
- Unit tests in `test/checksums.test.js`

## Note

True GPG/cosign signing deferred to RC/1.0. Hex sidecars + pinned manifest sha256 are the trust path for 0.3.
