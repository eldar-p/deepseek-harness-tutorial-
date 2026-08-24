# Deep CLI — Release Candidate

**Стадия:** `0.9.0-rc.0`  
**License:** [CC BY-NC-SA 4.0](./LICENSE)

```powershell
node bin/deep.js doctor --readiness --stage=rc
npm run test:coverage   # ≥70%
npm run audit:prebeta
```

## RC gate

| Критерий | Статус |
|----------|--------|
| Field beta `0.4.x` closed | ✅ |
| Coverage ≥70% | ✅ gate 70 |
| Pre-beta audits | ✅ 0 FAIL |
| Nightly 3-OS | ✅ |
| Checksum sidecars | ✅ |
| CDN Release zip upload | ⏳ needs `gh auth login` |

## Field matrix (manual)

- [ ] Windows + Docker Desktop + NVIDIA start/stop
- [ ] macOS Docker/Colima smoke (CPU)
- [ ] Linux Docker + CPU llama
- [ ] `deep update --channel beta` from Release asset

See [BETA.md](./BETA.md) · [todo/README-beta.md](./todo/README-beta.md)
