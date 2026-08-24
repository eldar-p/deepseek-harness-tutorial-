# Deep CLI — Beta track

**Стадия:** beta features landed on `main` · license [CC BY-NC-SA 4.0](./LICENSE)  
**Release asset:** https://github.com/eldar-p/deepseek-harness-tutorial-/releases/tag/v0.2.0-alpha  
(`deep-cli-0.2.0-alpha.zip`)

```powershell
node bin/deep.js doctor --readiness --stage=beta
node bin/deep.js update --channel beta
```

## Что вошло (beta)

| Область | Статус |
|---------|--------|
| Hard egress (iptables allowlist) | ✅ `deep-guest:0.2-beta` |
| Audit #22 context | ✅ PASS |
| Coverage ≥50% | ✅ ~70% |
| CDN zip + sha256 + install shim | ✅ Release uploaded |
| TTY / audit #18 | ✅ PASS |
| License CC BY-NC-SA 4.0 | ✅ |

Трекер: [todo/README-beta.md](./todo/README-beta.md) · Alpha: [ALPHA.md](./ALPHA.md)

## CDN install

```powershell
node bin/deep.js update --channel beta
# shim → %LOCALAPPDATA%\deep\bin  (добавь в PATH)
```

Локальный zip (без сети):

```powershell
npm run pack:release
$env:DEEP_CLI_ZIP = (Resolve-Path .\dist\deep-cli-0.2.0-alpha.zip).Path
node bin/deep.js update --channel beta
```

## До pre-beta / 0.3

- Полный audit gate pre-beta (все 26)
- Coverage → 50% строго по плану этапов + больше тестов `cli.js`/`llama.js`
- Auto-extract install polish / signed checksums
