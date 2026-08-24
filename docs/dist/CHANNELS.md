# Каналы распространения

| Channel | Аудитория | Обновления | Pre-alpha |
|---------|-----------|------------|-----------|
| **stable** | Пользователи | Проверенные ревизии манифестов | default |
| **beta** | Ранние тестеры | Чаще, возможны регрессии | `--channel=beta` |
| **edge** | Разработчики | Последний main | `--channel=edge` |

## Источники (сейчас)

1. **Git clone** + `npm link` или `scripts/install-deep.ps1|sh`
2. **Манифесты** в `manifests/` (локально; CDN refresh — alpha)
3. **cli-releases.json** — матрица бинарников `gim` (пусто до beta)

## Установка

```powershell
# Windows
powershell -File .\scripts\install-deep.ps1 -Channel stable

# macOS / Linux
./scripts/install-deep.sh --channel=stable
```

Env: `GIM_HOME`, `PREFIX` / `--prefix`, `CHANNEL`.

## Обновление

```bash
gim update --channel stable    # сверка revision; git hint если нет CDN
gim update --channel beta --dry-run
npm run pack:release            # локальный zip + sha256 для Release upload
```

Канон: `manifests/channels.json` → revision per channel; install/update читают один контракт.

**Лицензия артефактов:** Apache-2.0 (см. `LICENSE` в zip).

## CDN (beta)

```
GitHub Releases: gim-cli-{version}.zip
manifests/cli-releases.json → artifacts[].url + sha256
```

Все загрузки: **url + sha256** (или digest для guest image).