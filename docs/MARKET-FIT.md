# Market fit — Deep CLI

**Дата:** 2026-08-24 · **Продукт:** Deep CLI 1.0.x (`llama.cpp` + Docker guest + DSH)  
**Лицензия:** CC BY-NC-SA 4.0 (некоммерческая) — влияет на B2B-позиционирование.

Документ фиксирует **реальность продукта сегодня**, а не roadmap-мечты.

---

## 1. Что нужно рынку

| Ниша | Боль / спрос | Типичные покупатели |
|------|--------------|---------------------|
| **Legacy agents** | Старые агенты (VM + LM Studio / VirtualBox, «скрипты вокруг чата») тяжело сопровождать; нужен замена с тем же локальным LLM | Индивидуалы, старые tutorial-аудитории |
| **LLM guardrails** | Ограничить инструменты агента: без произвольного shell на хосте, без утечки секретов, с политикой сети | Security / platform teams, privacy-first users |
| **AI testing** | Повторяемый локальный стек для регрессии агентов, jail, egress, multi-instance | QA, agent authors, CI на своих машинах |
| **Team context orchestrators** | Общий контекст команды, память, оркестрация нескольких агентов/сессий | Product/eng teams (часто SaaS) |
| **Local no-code AI** | «Поставил и чатишь» без Docker/CLI/GGUF; GUI, магазины моделей | Массовый consumer / non-dev |

---

## 2. Что Deep CLI реально даёт сегодня

Архитектура (host Node CLI):

```text
User → deep CLI
         ├── llama-server   127.0.0.1 → OpenAI-compatible
         ├── deep-guest     Docker + iptables allowlist @ /workspace
         └── DSH web        UI + tools → llama + guest
```

| Возможность | Статус | Доказательство |
|-------------|--------|----------------|
| Локальный **llama.cpp** (prefetch, health, Q4 baseline / WARN на низких квантах) | ✅ | `bootstrap` / `start` / аудит 26 |
| **Docker guest** (`deep-guest`, `deep-net-enforce`) | ✅ | Dockerfile.guest, smoke:guest |
| **DSH** harness (web + plugins materialize) | ✅ | guest-bash-local, workspace-jail-fs |
| **Workspace jail** (агент не пишет куда попало) | ✅ | plugin + cordis patch |
| Host pwsh/bash **off** для агента; guest-exec | ✅ | isolation audit |
| **Network allowlist** / offline / open presets | ✅ | `allowlists.json` + iptables |
| **Multi-stack** (`--name`) + **GPU lock** | ✅ | stacks + lock file |
| Zero-traces presets, privacy off by default | ✅ | PRIVACY.md, аудит 25 |
| CDN zip + **sha256** verify (`deep update`) | ✅ частично | локальный pack; remote Release может быть 404 без upload |
| No-code GUI / cloud team orchestrator | ❌ | вне scope |
| Managed SaaS / commercial redistribution | ❌ | CC BY-NC-SA |

Поле: Windows + Docker Desktop + NVIDIA — field GREEN (Engine/Guest/Llama/DSH). macOS/Linux field — ещё не полностью подписаны.

---

## 3. Gap map

| Ниша | Покрытие | Комментарий |
|------|----------|-------------|
| Legacy agents | **we cover** | Прямая замена tutorial-трека (VirtualBox/LM Studio) на управляемый CLI-стек |
| LLM guardrails | **partial → strong local** | Jail + allowlist + guest-only tools — сильный *локальный* guardrail; нет enterprise policy UI / SIEM / IdP |
| AI testing | **cover (author kit)** | `deep test harness` + smoke:guest/e2e/api — документированный pack |
| Team context orchestrators | **no** | Память/сессия на одном хосте (`~/.deep`, DSH); нет shared team cloud |
| Local no-code AI | **no** | Требует Node, Docker, GGUF, CLI; DSH — UI поверх стека, не no-code installer |

Легенда: **we cover** / **partial** / **no**.

---

## 4. Positioning one-liner

> **Deep CLI — локальный оркестратор агента с жёсткой изоляцией:** llama.cpp + Docker-guest с allowlist и workspace jail + DSH, multi-stack и GPU lock, без облака и без tool-exec на хосте.

Коротко для README/landing: *«Локальный AI-агент в клетке: модель на хосте, инструменты в Docker, сеть по allowlist.»*

---

## 5. Следующие продуктовые ставки

Приоритет по gap map и текущим дырам:

1. **Trust path (CDN Release + подписи)** — ✅ Release [v1.1.0](https://github.com/eldar-p/deepseek-harness-tutorial-/releases/tag/v1.1.0) + sha256 in `cli-releases.json` (cosign optional later)  
2. **Linux/macOS field parity** — ✅ field-lite CI (ubuntu/macos) + scripts; full GGUF e2e still needs operator Mac/Linux with model  
3. **AI testing kit** — ✅ `deep test harness` + [HARNESS-TEST-PACK.md](./HARNESS-TEST-PACK.md)  
4. **Guardrails UX** — ✅ `deep doctor --policy` isolation grade; пресеты paranoia/offline уже в CLI  
5. **Не гнаться** за team orchestrator / no-code consumer, пока лицензия NC и стек Docker-heavy; иначе размытие ниши.

Анти-ставки: SaaS multi-tenant, App Store no-code, коммерческий white-label без смены лицензии.
