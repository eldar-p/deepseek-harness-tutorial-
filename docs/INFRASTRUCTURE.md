# Инфраструктура вокруг Deep CLI

Четыре опоры продукта (pre-alpha — каркас, без CDN publish).

| Блок | Документ | Статус |
|------|----------|--------|
| **Распространение** | [dist/CHANNELS.md](./dist/CHANNELS.md) · [dist/RELEASE.md](./dist/RELEASE.md) | local install + manifests |
| **Документация** | [README.md](./README.md) (индекс) | INSTALL, ARCHITECTURE, TROUBLESHOOTING |
| **Сообщество** | [../CONTRIBUTING.md](../CONTRIBUTING.md) | templates + release process |
| **Legal** | [legal/](./legal/) | CC BY-NC-SA 4.0, third-party, commercial notice |

## Команды

```bash
npm run infra:check    # готовность дистрибутива (LICENSE, manifests, docs)
npm run audit          # 26 аудитов
node bin/deep.js update --channel stable   # pre-alpha: проверка канала
```

## CI

- `.github/workflows/ci.yml` — test + coverage + audit (3 OS)
- `.github/workflows/release-check.yml` — infra check на main/tag

## Связь с версиями

См. [VERSION-PLAN.md](./VERSION-PLAN.md): CDN и signed releases — **beta+**; сейчас git clone + `scripts/install-deep.*`.
