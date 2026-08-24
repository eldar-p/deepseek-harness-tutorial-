# Каналы распространения

| Channel | Аудитория | Обновления | Pre-alpha |
|---------|-----------|------------|-----------|
| **stable** | Пользователи | Проверенные ревизии манифестов | default |
| **beta** | Ранние тестеры | Чаще, возможны регрессии | `--channel=beta` |
| **edge** | Разработчики | Последний main | `--channel=edge` |

## Источники (сейчас)

1. **Git clone** + `npm link` или `scripts/install-deep.ps1|sh`
2. **Манифесты** в `manifests/` (локально; CDN refresh — alpha)
3. **cli-releases.json** — матрица бинарников `deep` (пусто до beta)

## Установка

```powershell
# Windows
powershell -File .\scripts\install-deep.ps1 -Channel stable

# macOS / Linux
./scripts/install-deep.sh --channel=stable
```

Env: `DEEP_HOME`, `PREFIX` / `--prefix`, `CHANNEL`.

## Обновление

```bash
deep update --channel stable    # pre-alpha: сверка revision, подсказка git pull
deep bootstrap --channel beta   # перечитать channel в config
```

Канон: `manifests/channels.json` → revision per channel; install/update читают один контракт.

## CDN (planned beta)

```
https://cdn.example/deep/manifests/channels.json
https://cdn.example/deep/releases/{channel}/{os}-{arch}/deep-{version}.zip
```

Все загрузки: **url + sha256** (или digest для guest image).
