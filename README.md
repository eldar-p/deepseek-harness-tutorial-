# DeepSeek Harness — туториал

Установка и загрузка: Windows + VirtualBox (Debian) + LM Studio + DeepSeek Harness (`dsh`).

## Что скачать

- Debian netinst ISO: https://ftp.psn.ru/debian-cd/13.6.0/amd64/iso-cd/debian-13.6.0-amd64-netinst.iso
- Oracle VirtualBox (+ Extension Pack по желанию): https://www.oracle.com/virtualization/technologies/vm/downloads/virtualbox-downloads.html
- Репозиторий: `git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git`
- LM Studio: https://lmstudio.ai/
- Node.js **^22.19.0 или ≥24.0.0** (требование `@deepseek-ai/dsh`): https://nodejs.org/

## 1. VirtualBox

1. Установи VirtualBox.
2. Создай ВМ: Linux, Debian (64-bit).
3. Выдели достаточно RAM и CPU, диск VDI динамический.
4. В Storage подключи скачанный ISO.
5. Сеть: NAT.
6. Shared Folders: выбери папку на хосте, включи автомонтирование (после установки ОС понадобятся Guest Additions).

### Port Forwarding (NAT)

| Name | Protocol | Host IP   | Host Port | Guest Port |
|------|----------|-----------|-----------|------------|
| ssh | TCP | 127.0.0.1 | 2222 | 22 |
| torsocks | TCP | 127.0.0.1 | 9050 | 9050 |

`9050` нужен только если Tor SOCKS крутится в госте.

## 2. Debian

1. Запусти ВМ и пройди установщик netinst.
2. Создай обычного пользователя (и root/sudo по шагам установщика).
3. В выборе ПО отметь SSH server.
4. Установи GRUB на диск ВМ.
5. После установки отключи ISO и перезагрузись.

В консоли гостя (если SSH ещё не поднят):

```bash
su -
apt-get update
apt-get install -y openssh-server curl ca-certificates
systemctl enable --now ssh
```

На хосте:

```text
ssh -p 2222 USER@127.0.0.1
```

### Shared folder

1. Установи VirtualBox Guest Additions в госте.
2. Добавь пользователя в группу `vboxsf`, перелогинься.
3. Шара обычно видна как `/media/sf_ИМЯ_ШАРЫ`.

## 3. LM Studio

1. Установи LM Studio.
2. Скачай и загрузи модель.
3. Запусти Local Server (порт по умолчанию `1234`).
4. При необходимости CLI: `lms load …`, `lms server start`.

Проверка: `http://127.0.0.1:1234/v1/models`  
OpenAI-compatible base URL: `http://127.0.0.1:1234/v1`

## 4. DeepSeek Harness

Пакет: `@deepseek-ai/dsh`. Команда: `dsh`.  
Домашний каталог: `$DSH_HOME`, иначе по умолчанию `~/.dsh` (на Windows — `%USERPROFILE%\.dsh`).

### Установка и запуск UI

```text
npx @deepseek-ai/dsh web
```

или глобально:

```text
npm install -g @deepseek-ai/dsh
dsh web
```

UI по умолчанию: `http://127.0.0.1:3080`  
Порт при необходимости: `dsh web --port 3080`

### Модели

1. В UI: Settings → Models.
2. Для облака DeepSeek — API-ключ с https://platform.deepseek.com/
3. Для локальной модели — OpenAI-compatible endpoint LM Studio (`http://127.0.0.1:1234/v1`) и id загруженной модели.
4. Выбери workspace и модель, затем новый чат.

Shell агента по умолчанию работает на машине, где запущен `dsh` (хост). ВМ Debian — отдельная среда: заходи в неё по SSH с хоста (`2222`), это не встроено в `dsh` само по себе.

### SSH-ключ на гостя (по желанию)

```text
ssh-keygen -t ed25519
```

Публичный ключ добавь в `~/.ssh/authorized_keys` пользователя гостя.

## 5. Запуск после перезагрузки

1. Старт ВМ.
2. SSH на `2222`.
3. LM Studio → Local Server → модель загружена.
4. `npx @deepseek-ai/dsh web` (или `dsh web`).
5. Новый чат в UI.

| Порт | Сервис        |
|------|---------------|
| 1234 | LM Studio API |
| 3080 | DSH web       |
| 2222 | SSH в гостя   |
| 9050 | Tor SOCKS (если настроен) |

Дальше — донастройка стека: §7–18 (плагины, patch, skills, Tor, guest toolkit).

## 6. Чеклист

- [ ] Node.js ^22.19.0 или ≥24
- [ ] В госте работает `sshd`
- [ ] С хоста есть SSH на `2222`
- [ ] Guest Additions установлены, shared folder доступен
- [ ] LM Studio слушает `1234`, модель загружена
- [ ] DSH открывается на `3080`

---

## 7. Архитектура стека (что строится поверх базового DSH)

Идея: **один** локальный coder (LM Studio) + **весь shell только в Debian VM** + **все файлы на shared folder** + **сеть наружу только через Tor в госте**.

```text
Windows host                     Debian VM
─────────────                    ─────────
LM Studio :1234  (coder)
DSH web   :3080  ──bash tool──►  SSH :22  (forward host:2222)
Read/Write/Glob  ◄──share──────►  <VM_MOUNT>/…
                 optional NAT    Tor SOCKS :9050 (forward host:9050)
```

Плейсхолдеры:

| Роль | Плейсхолдер |
|------|-------------|
| Shared folder на хосте | `<HOST_SHARE>` |
| Та же папка в госте | `<VM_MOUNT>` |
| Home DSH | `<DSH_HOME>` |
| Каталог скриптов хоста | `<AI_SCRIPTS>` |
| Model id в LM Studio | `coder` |

Одинаковый файл: `<HOST_SHARE>/foo.py` ↔ `<VM_MOUNT>/foo.py`.  
Крупные проекты: `<HOST_SHARE>/projects/<slug>/`.

Дополнительный NAT forward (Tor):

| Name | Protocol | Host IP | Host Port | Guest Port |
|------|----------|---------|-----------|------------|
| torsocks | TCP | 127.0.0.1 | 9050 | 9050 |

---

## 8. Кастомные плагины DSH

Каталог: `<DSH_HOME>/profiles/<profile>/dsh-plugins/`.  
Подключение в `cordis.patch.yml` через `file:///…`.

| Плагин | Что делает |
|--------|------------|
| **vm-bash-local** | Подменяет executor `bash`: каждая команда → SSH в VM (`vm-exec.ps1` / аналог), не хостовый shell |
| **path-fix-fs** | FS backend: перед resolve переписывает `/home/…`, `/tmp/…`, `*\mnt\hostshare\…`, кривые `F:\home\…` → `<HOST_SHARE>` |
| **one-shot-guard** | Hard deny на `tools/pre-execute`: `todo_write`; probe-bash (`pwd`/`ls`/`cd`/`--version`/`which`/`python -c …version`); голый `pip` / `--break-system-packages` (venv под `projects/` ок); README/LICENSE/CHANGELOG в **корне** шары; emoji в путях/исходниках |
| **harness-narrative** | Из активности tools синтезирует раскрываемый Think (`reasoning` block-start / delta / end) без thinking-модели; на waterfall `tools/pre-execute` обязательно звать `next()` |

Рекомендуемые таймауты/лимиты для **vm-bash-local**: длинный `timeoutMs` (часы), `maxOutputBytes` ~48KB, spill на диск для огромного stdout.

---

## 9. Patch профиля (`cordis.patch.yml`) — штатные тулы

| Настройка | Значение |
|-----------|----------|
| `tool-bash` | enabled |
| `tool-pwsh` / pwsh-sandbox | **disabled** |
| bash-sandbox / fs-sandbox штатные | **disabled** (вместо них path-fix-fs + VM) |
| `tool-fs` Read | `readLimit` ~400, `readMaxLineLength` ~2000, `readMaxBytes` ~120000 |
| web-search / web fetch | **disabled** (clearnet с хоста запрещён) |
| `tool-todo` | **disabled** |
| preset агента | `vm-only` (или свой) |
| sandbox / approval | `danger-full-access` + policy `never` (только локально) |
| compaction | раньше: `thresholdRatio` ~0.45, `retainRatio` ~0.12, `maxTokens` ~3072, auto |
| tool-result-pruner | резать дампы до compaction (~2800 / head 1400 / tail 400) |
| system-prompt | без harness identity / runtime noise; persona = solo + path map + STOP |
| agent-instructions | `maxBytes` ~16KB |

Persona (смысл, не копипаста путей):

- один model id `coder`, без второго «researcher»
- shell = только `bash` (VM)
- host Read/Write только под `<HOST_SHARE>`; bash только `<VM_MOUNT>`
- web: `curl --socks5-hostname 127.0.0.1:9050`
- one-shot vs large-project правила (см. §12)
- нет emoji → `[OK]` / `[FAIL]` / `[WARN]`
- после ответа — STOP, без повторных summary
- goals только для крупных задач, сразу `complete_goal`

Дублировать те же правила в `<DSH_HOME>/AGENTS.md`.

---

## 10. Settings DSH (`settings.yaml`)

- default model: provider LM Studio, id `coder`
- `baseURL`: `http://127.0.0.1:1234/v1`
- `contextWindow` ≈ 98304 (или под свою VRAM)
- `maxTokens` ≈ 8192
- compat: без developer role; поле `max_tokens`
- UI theme: dark (по желанию)
- default agent preset: `vm-only`

Env при старте:

```text
DSH_HOME=<DSH_HOME>
DSH_PERMISSION_MODE=danger-full-access
LM_STUDIO_API_KEY=lm-studio
```

---

## 11. Skills

### В `<DSH_HOME>/skills/` (имена как в стеке)

| Skill | Назначение |
|-------|------------|
| **agent-speed** | grep/glob вместо гигантских Read; quote shell; без воды и emoji |
| **path-map-vm** | таблица host ↔ VM; bash-only |
| **search-large-files** | `rg`/`grep` → узкий Read вокруг hit |
| **large-project** | `projects/<slug>/`, goals, STRUCTURE, модули, `.venv` внутри проекта |
| **frontend-ui** | нормальный CSS/шрифты/атмосфера, не голый Times+blue links |
| **web-access** | поиск/fetch только через Tor |
| **web_researcher** | Tor-only research (без built-in clearnet Search) |

Имена skills в реальном стеке могут чуть отличаться (`agent-speed` / `search-large-files` / `frontend-ui`) — смысл тот же.

### Knowledge / playbooks (`<AI_SCRIPTS>/skills|knowledge/` и/или шара)

| Документ | Тема |
|----------|------|
| `debian` | apt, systemd, пути гостя |
| `tor` / `privacy-tor` | SOCKS, torsocks, без clearnet с хоста |
| `onion` | .onion / осторожный доступ |
| `api` | HTTP API через Tor |
| `archives` | list/extract архивов |
| `vm-only` / `vm-whoami` | вся работа только в VM |
| `qwen-coder` | локальный coder id, ctx, solo |
| `dsh-1m` | облачный DeepSeek 1M через API (не GGUF) |
| `web-access` / `web_researcher` | дубли skills для workspace |

На шаре и в `<DSH_HOME>` держи согласованные **AGENTS.md** / **.clinerules** с той же path-map и bash-only политикой.

---

## 12. Поведение агента (one-shot / large / files / net)

| Режим | Правила |
|-------|---------|
| **One-shot** | один файл на шаре → один bash → один ответ; без root README/LICENSE; без todo; без probe `pwd`/`ls`/`python --version`; pip только в venv под `projects/` |
| **Large** | только `projects/<slug>/` + `create_goal` + `STRUCTURE.txt` + модули + optional `.venv` + `complete_goal` |
| **Huge files** | сначала `rg`/`grep`, потом Read `limit`≤120 вокруг hit |
| **Frontend** | CSS, шрифты, атмосфера, designed first viewport |
| **Network** | clearnet search/fetch в DSH выкл.; из VM: SOCKS `127.0.0.1:9050` |
| **Ошибка пути** | max 2 ретрая; переписать на share-pair, не крутить Write→chmod→ls |
| **Guard deny** | сразу Write скрипт / ASCII rewrite; не зондировать снова |

---

## 13. Скрипты хоста (`<AI_SCRIPTS>/`)

| Скрипт | Назначение |
|--------|------------|
| **after-reboot-start.ps1** | one-shot: VM → ждать порты → load coder → start DSH |
| **start-solo-max.ps1** | `lms unload --all` → load solo model, `--gpu max`, ctx ~96K, id `coder` (MTP если есть) |
| **start-solo-256k.ps1** | длинный контекст (медленнее) |
| **start-dual-lms.ps1** | (устаревший dual — обычно не нужен в solo) |
| **start-dsh.ps1** | `DSH_HOME` + `danger-full-access` + junction + `dsh web --port 3080` |
| **ensure-hostshare-junction.ps1** | junction вроде `X:\mnt\hostshare` → `<HOST_SHARE>` (модель часто выдумывает такие пути) |
| **vm-exec.ps1** | SSH bash в VM; им пользуются плагин и ручные команды |
| **load-1m.ps1** / docs | путь на облачный DeepSeek 1M через harness API (не GGUF) |
| **REBOOT-CHECKLIST.md** / **NET.md** | порты, порядок старта, сеть |
| **tool-verify.json** + **verify-tor-tools.py** | smoke-проверка тулов/Tor после ребута |
| **torrc.client** | клиентский Tor/Snowflake конфиг (копия для гостя) |

Порядок после ребута: **VM → SSH :2222 → LM Studio + coder → DSH → новый чат**.

---

## 14. Guest / share toolkit (на `<HOST_SHARE>`)

Скрипты и обвязка внутри шары (выполняются в VM):

| Артефакт | Назначение |
|----------|------------|
| **guest-setup.sh** | ssh keys, sshd, базовая диагностика сети |
| **tor-up.sh** + **torrc.client** | поднять Tor/Snowflake SOCKS на `9050` |
| **install-agent-lean.sh** | lean apt через Tor; sudo NOPASSWD; apt-cache на шаре (малый rootfs) |
| **install-agent-stack.sh** / **setup-agent-kit.sh** | более полный стек инструментов / venv + PySocks |
| **setup-persist-disk.sh** | персистентный диск / данные вне overlay |
| **archive-open.sh** | list/extract архивов |
| **find-tor.sh**, **verify-tor-tools.py** | проверка Tor-инструментов |
| **TOOLKIT.md** | карта возможностей агента в VM (пакеты, ops, MCP, ограничения) |
| **AGENTS.md** / **.clinerules** | path/shell правила для workspace |
| **projects/** | корень крупных проектов агента |
| **apt-cache/** | кэш apt на шаре (экономия rootfs) |

### Расширенный guest stack (по желанию)

Описывается в `TOOLKIT.md`, не обязателен для минимального DSH:

| Слой | Возможности |
|------|-------------|
| **Базовые пакеты** | bash, python3, node, rg, fzf, jq, curl, git, build-essential, nmap/tcpdump (осторожно с политикой) |
| **agent-ops** | checkpoint, queue, status, cleanup, report, journal/net/process snapshots |
| **agent-mind** | episodic/semantic память, priority queue, drift/dedup, daily review, smoke selftest |
| **tor-net MCP** | трафик только через SOCKS 9050 |
| **vbox / host bridge MCP** | управление/статус VM с хоста (если используешь) |
| **Enrich через Tor** | wiki/arxiv/CVE/whois и т.п. — только с ключами/политикой, без clearnet с Windows |

Тяжёлое (Docker/K8s/полноценный V2Ray) обычно выносится на расширенный диск — см. отдельную заметку `heavy-stacks` в knowledge.

---

## 15. LM Studio — solo load

```text
lms unload --all
lms load <model> -c 98304 --gpu max --parallel 1 --identifier coder
lms ps
```

- один инстанс `coder` (без второй модели на той же VRAM)
- speculative/MTP — если сборка LM Studio умеет; иначе plain load
- Local Server: `http://127.0.0.1:1234/v1`

---

## 16. Порты итогового стека

| Порт | Сервис |
|------|--------|
| 1234 | LM Studio API |
| 3080 | DSH web |
| 2222 | SSH → Debian |
| 9050 | Tor SOCKS (NAT forward в гостя) |

---

## 17. Карта разработок (сводка)

| Слой | Артефакты |
|------|-----------|
| Плагины | vm-bash-local, path-fix-fs, one-shot-guard, harness-narrative |
| Patch | pwsh/web/todo off; Read caps; compaction; tool-result-pruner; persona STOP |
| Skills | agent-speed, path-map-vm, search-large-files, large-project, frontend-ui, web-access, web_researcher |
| Host scripts | after-reboot, start-solo-max / 256k, start-dsh, ensure-junction, vm-exec, verify |
| Guest/share | guest-setup, tor-up, lean/full install, archive-open, TOOLKIT, projects/ |
| Политика | solo coder, bash-only VM, share-only FS, Tor-only web, no emoji, one-shot guard |

---

## 18. Чеклист «полный стек»

- [ ] База §1–6 готова (VM, SSH, LM Studio, DSH)
- [ ] NAT: `2222` и (если Tor) `9050`
- [ ] Share смонтирован как `<VM_MOUNT>`; junction на хосте для ложных путей
- [ ] Плагины: vm-bash-local, path-fix-fs, one-shot-guard, harness-narrative
- [ ] Patch: pwsh/web-search/todo off; compaction + pruner; Read caps
- [ ] `AGENTS.md` + skills + knowledge на месте
- [ ] `start-solo-max` + `start-dsh` (+ after-reboot) работают
- [ ] Tor в госте: `curl --socks5-hostname 127.0.0.1:9050 …` (или свой check)
- [ ] (Опционально) lean install + TOOLKIT ops/mind
- [ ] Smoke: новый чат → Write на шару → bash видит файл через `<VM_MOUNT>` → один ответ без probe/emoji
