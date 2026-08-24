# GIM CLI на Linux

Native Linux и **WSL** (Windows Subsystem for Linux) — основные платформы для Colibri Docker и полного стека.

Новичкам: [README_BEGINNER.md](../README_BEGINNER.md) · Windows: тот же гайд, §4 · macOS: [MACOS.md](../MACOS.md)

---

## Поддерживаемые дистрибутивы

| Среда | Статус | Примечание |
|-------|--------|------------|
| **Ubuntu / Debian** 22.04+ | ✅ primary | CI, field-linux.sh |
| **Fedora / RHEL-like** | ✅ | Docker CE или Podman |
| **WSL2 + Docker Desktop** | ✅ | integration с Windows engine |
| **WSL2 + только apt docker** | ⚠️ | часто **второй** daemon — см. ниже |
| **Arch / Nix** | ⚠️ | community; проверяйте `gim doctor` |

Linux в гайде для новичков не был с самого начала — документ писался под Windows. В продукте Linux **равноправен** (unit tests + field-lite в CI на `ubuntu-latest`).

---

## Требования

- **Node.js** ^22.19 или ≥24
- **Docker Engine** или **Podman** (rootless возможен с ограничениями)
- Пользователь **не root** + член группы `docker` (или `podman` socket)
- **LLM:** Colibri Docker (default Win/Linux), **или** `--gguf`, **или** `--api`

```bash
node --version
docker version    # Client + Server без ошибки
groups            # должна быть docker
```

---

## Быстрая установка (Ubuntu/Debian)

```bash
# Node 22 (пример через NodeSource — или nvm)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Docker (официальный репозиторий Docker)
# https://docs.docker.com/engine/install/ubuntu/
sudo usermod -aG docker "$USER"
# выйти и войти в сессию

mkdir -p ~/ai/models
git clone https://github.com/eldar-p/gim-cli.git ~/ai/gim
cd ~/ai/gim
node bin/gim.js doctor
```

---

## Три режима LLM на Linux

### 1. Colibri Docker (по умолчанию `gim start` без `--gguf`)

Нужны: NVIDIA + Container Toolkit, модель safetensors, Linux `coli` в `GIM_COLIBRI_ROOT`.

```bash
node bin/gim.js start
node bin/gim.js doctor --speed
```

См. [docs/ARCHITECTURE.md](./ARCHITECTURE.md) · [docs/SPEED.md](./SPEED.md)

### 2. Локальный GGUF (llama-server)

```bash
node bin/gim.js bootstrap --gguf ~/ai/models/model.Q4_K_M.gguf
node bin/gim.js start --gguf ~/ai/models/model.Q4_K_M.gguf
```

**GPU на Linux:** официальный pin — **Vulkan** (не CUDA zip из manifests). Свой CUDA build:

```bash
export GIM_LLAMA_BIN=/path/to/llama-server
node bin/gim.js start --gguf ~/ai/models/model.gguf
```

### 3. Облачный API

```bash
node bin/gim.js bootstrap --api deepseek --api-key sk-...
node bin/gim.js start --api deepseek
```

---

## WSL (Windows)

Рекомендуется **Docker Desktop → Settings → Resources → WSL integration** для вашего дистрибутива.

| Проблема | Решение |
|----------|---------|
| `docker` в WSL не видит образы Windows | включить integration или `docker load` образа |
| DSH из `/mnt/c/...` | Linux install: `npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2` |
| Два docker daemon | не смешивать Desktop и standalone `dockerd` без нужды |

```bash
bash scripts/field-linux-wsl.sh --gguf /mnt/c/ai/models/model.gguf
# или модель в Linux FS: ~/ai/models/ (быстрее I/O)
```

---

## Field-скрипты

```bash
# Offline + llama fetch (без полного стека)
node bin/gim.js field lite

# Полный прогон с GGUF
bash scripts/field-linux.sh --gguf ~/ai/models/model.gguf

# WSL helper
bash scripts/field-linux-wsl.sh --gguf ~/ai/models/model.gguf
```

Readiness: `node bin/gim.js doctor --readiness --stage=field`

---

## Типичные проблемы (Linux)

| Симптом | Причина | Действие |
|---------|---------|----------|
| `permission denied` на docker.sock | не в группе `docker` | `sudo usermod -aG docker $USER`, re-login |
| `Refuse gim start as root` | запуск от root | обычный пользователь |
| Guest build fail | нет buildx | `sudo apt install docker-buildx-plugin` |
| Llama: wrong ELF / GLIBC | бинарник не от pin | `gim doctor`; авто-fetch llama |
| OOM при большой модели | мало RAM/VRAM | меньшая модель, `--cpu`, ниже ctx |
| Colibri OOM на 512K ctx | `GIM_CTX` vs RAM | см. `gim doctor --speed` |

Логи: `~/.gim/run/<stack>/`, `~/.gim/logs/gim.log`

---

## Остановка

```bash
node bin/gim.js stop              # guest/UI off; Colibri warm (default)
node bin/gim.js stop --full-stop  # снять LLM-контainer
```

---

## Чеклист Linux

- [ ] Node ≥ 22.19, не root  
- [ ] `docker version` OK  
- [ ] проект в `~/ai/gim` (латиница, без пробелов)  
- [ ] `gim doctor` engine GREEN  
- [ ] выбран режим: Colibri / `--gguf` / `--api`  
- [ ] `gim status` → UI в браузере  
- [ ] `gim stop` после работы  

---

## Связанные документы

- [OS-COMPAT.md](./OS-COMPAT.md) — матрица CI/field  
- [INSTALL.md](./INSTALL.md) — каналы, layout `~/.gim`  
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)  
