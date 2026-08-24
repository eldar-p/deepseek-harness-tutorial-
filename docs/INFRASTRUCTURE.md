# Инфраструктура вокруг GIM CLI

Четыре опоры продукта (pre-alpha — каркас, без CDN publish).

| Блок | Документ | Статус |
|------|----------|--------|
| **Распространение** | [dist/CHANNELS.md](./dist/CHANNELS.md) · [dist/RELEASE.md](./dist/RELEASE.md) | local install + manifests |
| **Документация** | [README.md](./README.md) (индекс) | INSTALL, ARCHITECTURE, TROUBLESHOOTING |
| **Сообщество** | [../CONTRIBUTING.md](../CONTRIBUTING.md) | templates + release process |
| **Legal** | [legal/](./legal/) | Apache-2.0, third-party, commercial notice |

## Команды

```bash
npm run infra:check    # готовность дистрибутива (LICENSE, manifests, docs)
npm run audit          # gate pre-alpha (7 checks)
npm run audit:security # audits 1–32
node bin/gim.js update --channel stable
```

## CI

- `.github/workflows/ci.yml` — test + coverage + audit (3 OS)
- `.github/workflows/release-check.yml` — infra check на main/tag

## Связь с версиями

См. [VERSION-PLAN.md](./VERSION-PLAN.md): CDN — **beta+**; установка: `scripts/install-gim.*` или git clone.
