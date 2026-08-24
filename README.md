# DeepSeek Harness — туториал + Deep CLI

**Продукт:** [Deep CLI Pre-alpha](./PRE-ALPHA.md) — [документация](./docs/README.md) · [инфраструктура](./docs/INFRASTRUCTURE.md) · [план версий](./docs/VERSION-PLAN.md) · [аудиты](./docs/AUDITS.md)

| ОС | Deep CLI | Legacy |
|----|----------|--------|
| **Windows** | `scripts/install-deep.ps1` | `install.ps1` + `host/` |
| **macOS** | `scripts/install-deep.sh` | `install.sh` + `host-mac/` |

```bash
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
```

---

## Содержимое репозитория

```text
dsh-plugins/          кастомные плагины DSH
skills/               agent-speed, path-map-vm, …
config/               cordis.patch.yml, settings.yaml, AGENTS.md
host/                 Windows: vm-exec.ps1, start-*.ps1, …
host-mac/             macOS: vm-exec.sh, start-*.sh, …
guest/                guest-setup.sh, tor-up.sh, … (общие)
knowledge/            шпаргалки
env.example           Windows → env.ps1
env.sh.example        macOS → env.sh
install.ps1           установка на Windows
install.sh            установка на macOS
MACOS.md              туториал для Mac
```

---

## 0. База (один раз)

1. VirtualBox + Debian (SSH server).
2. Shared Folder: хост `<HOST_SHARE>` ↔ гость `/mnt/hostshare` (или `/media/sf_…` + bind).
3. NAT forward:

| Name | Host | Guest |
|------|------|-------|
| ssh | 127.0.0.1:2222 | 22 |
| torsocks | 127.0.0.1:9050 | 9050 |

4. Node.js **^22.19 или ≥24**, LM Studio, пакет `@deepseek-ai/dsh`.
5. SSH-ключ хоста → `~/.ssh/authorized_keys` гостя (`guest/guest-setup.sh` + `SSH_PUBKEY=…`).

---

## 1. Установка наших файлов

```powershell
copy env.example env.ps1
# отредактируй DSH_HOME, HOST_SHARE, LM_STUDIO_MODEL, VM_SSH_USER
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

`install.ps1` копирует:

- плагины → `%DSH_HOME%\profiles\web\dsh-plugins\`
- skills → `%DSH_HOME%\skills\`
- `cordis.patch.yml` / `AGENTS.md` / `settings.yaml` → home профиля
- `guest/*` → `%HOST_SHARE%\guest-toolkit\`
- `host/*` → `%HOST_SHARE%\ai\`

---

## 2. Запуск

```powershell
# модель
powershell -File .\host\start-solo-max.ps1

# UI
powershell -File .\host\start-dsh.ps1
```

Открой http://127.0.0.1:3080 — **новый** чат.

После ребута:

```powershell
powershell -File .\host\after-reboot-start.ps1
```

---

## 3. Что делает стек

| Компонент | Роль |
|-----------|------|
| **vm-bash-local** | каждый `bash` уходит в VM через `host/vm-exec.ps1` (Win) или `host-mac/vm-exec.sh` (Mac) |
| **path-fix-fs** | `/home/…`, `/tmp/…`, `*\mnt\hostshare\…` → `HOST_SHARE` |
| **one-shot-guard** | deny: todo, probe bash, bare pip, root README/LICENSE, emoji |
| **harness-narrative** | раскрываемый Think из tool-шагов |
| **skills** | скорость, path-map, большие файлы/проекты, UI, Tor-web |
| **guest/** | sshd, Tor, lean install, persist disk, TOOLKIT |

Политика: один model id `coder`, только bash в VM, файлы только на share, web через Tor `:9050`, без emoji, STOP после одного ответа.

---

## 4. Порты

| Порт | Сервис |
|------|--------|
| 1234 | LM Studio |
| 3080 | DSH web |
| 2222 | SSH → Debian |
| 9050 | Tor SOCKS |

---

## 5. Чеклист

- [ ] Debian + SSH :2222
- [ ] Share смонтирован в госте
- [ ] `env.ps1` заполнен, `install.ps1` ок
- [ ] `lms` видит модель, `start-solo-max` загрузил `coder`
- [ ] `start-dsh` → :3080
- [ ] В чате: Write на share → bash видит файл через `/mnt/hostshare`

Подробности по гостевым тулам: `guest/TOOLKIT.md`.  
Сетевые заметки: `host/NET.md`, `knowledge/`.
