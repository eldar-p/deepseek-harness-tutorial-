# DeepSeek Harness — туториал для macOS

Стек тот же: **Mac host** + **Debian VM** + **LM Studio** + **DSH** + плагины из этого репо.  
Гостевые скрипты (`guest/`) общие с Windows. Host-скрипты для Mac — в `host-mac/`.

```bash
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
```

Windows-гайд: [README.md](./README.md).

---

## Отличия от Windows

| | Windows | macOS |
|--|---------|--------|
| Установка стека | `install.ps1` + `env.ps1` | `install.sh` + `env.sh` |
| SSH в VM | `host/vm-exec.ps1` | `host-mac/vm-exec.sh` |
| Запуск | `start-solo-max.ps1` / `start-dsh.ps1` | `host-mac/start-solo-max.sh` / `start-dsh.sh` |
| Ложные пути | junction `mklink /J` | symlink `ensure-hostshare-link.sh` |
| Гипервизор | VirtualBox | VirtualBox **или** UTM (Apple Silicon) |

Плагины/skills/guest/config — те же папки репозитория.

---

## 0. Что поставить на Mac

1. **Node.js** ^22.19 или ≥24 — https://nodejs.org/  
2. **LM Studio** (Apple Silicon / Intel) — https://lmstudio.ai/  
3. **Гипервизор + Debian:**
   - **VirtualBox** (Intel; на Apple Silicon — если есть рабочая Arm-сборка) — https://www.virtualbox.org/
   - или **UTM** (рекомендуется на Apple Silicon) — https://mac.getutm.app/
4. Debian netinst ISO (arm64 на Apple Silicon, amd64 на Intel):  
   https://www.debian.org/distrib/

```bash
# DSH CLI
npm install -g @deepseek-ai/dsh
# проверка
node -v
dsh --version
lms --help   # CLI из LM Studio, обычно в PATH после установки
```

---

## 1. Debian VM

### VirtualBox

1. New VM → Linux → Debian (64-bit / Arm).
2. RAM/CPU с запасом, диск VDI динамический.
3. Storage → подключи ISO.
4. Network → NAT.
5. Shared Folders → папка на Mac (например `~/vm-share`), Auto-mount.
6. Port Forwarding:

| Name | Protocol | Host IP | Host Port | Guest Port |
|------|----------|---------|-----------|------------|
| ssh | TCP | 127.0.0.1 | 2222 | 22 |
| torsocks | TCP | 127.0.0.1 | 9050 | 9050 |

### UTM (Apple Silicon)

1. Create → Virtualize → Linux → Debian arm64 ISO.
2. В Sharing / Directory Share укажи `~/vm-share` (или аналог).
3. Network: Shared Network / Emulated VLAN; добавь **port forward** 2222→22 и 9050→9050 (в UI UTM: Network → Port Forwarding).
4. После установки гостя смонтируй share в `/mnt/hostshare` (virtio-fs / 9p — как в доке UTM).

### Внутри Debian

```bash
su -
apt-get update
apt-get install -y openssh-server curl ca-certificates
systemctl enable --now ssh
```

С Mac:

```bash
ssh-keygen -t ed25519   # если ещё нет ключа
# на госте: authorized_keys, либо:
SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" bash /mnt/hostshare/guest-toolkit/guest-setup.sh
```

Проверка:

```bash
ssh -p 2222 kodachi@127.0.0.1
```

Shared folder в госте часто `/media/sf_…` (VirtualBox) — сделай bind:

```bash
sudo mkdir -p /mnt/hostshare
sudo mount --bind /media/sf_ИМЯ_ШАРЫ /mnt/hostshare
# или fstab / UTM virtio mount → /mnt/hostshare
```

---

## 2. LM Studio

1. Установи LM Studio, скачай GGUF под свой чип (Metal).
2. Developer → Local Server → порт **1234**.
3. Или CLI:

```bash
lms load <model> -c 98304 --gpu max --parallel 1 --identifier coder -y
lms ps
curl -s http://127.0.0.1:1234/v1/models
```

На Apple Silicon ctx подбирай под unified memory (часто 32K–96K).

---

## 3. Установка нашего стека

```bash
cp env.sh.example env.sh
# nano env.sh  → DSH_HOME, HOST_SHARE, LM_STUDIO_MODEL, VM_SSH_USER
chmod +x install.sh host-mac/*.sh guest/*.sh
./install.sh
```

`install.sh` кладёт:

- плагины → `$DSH_HOME/profiles/web/dsh-plugins/`
- skills → `$DSH_HOME/skills/`
- patch / AGENTS / settings → home профиля
- `guest/*` → `$HOST_SHARE/guest-toolkit/`
- `host-mac/*` → `$HOST_SHARE/ai/`
- `VM_EXEC=$HOST_SHARE/ai/vm-exec.sh`

---

## 4. Запуск

```bash
./host-mac/start-solo-max.sh
./host-mac/start-dsh.sh
```

Открой http://127.0.0.1:3080 — **новый** чат.

После ребута Mac / VM:

```bash
./host-mac/after-reboot-start.sh
```

Проверка SSH-обёртки:

```bash
./host-mac/vm-exec.sh 'uname -a && ls /mnt/hostshare | head'
```

---

## 5. Плагины (те же)

| Плагин | Назначение |
|--------|------------|
| **vm-bash-local** | `bash` → `host-mac/vm-exec.sh` → SSH VM |
| **path-fix-fs** | кривые пути → `HOST_SHARE` |
| **one-shot-guard** | deny todo / probe / bare pip / root README / emoji |
| **harness-narrative** | Think из tool-шагов |

Политика та же: solo `coder`, только bash в VM, файлы на share, Tor `:9050`, `[OK]`/`[FAIL]`, STOP после ответа.

---

## 6. Порты

| Порт | Сервис |
|------|--------|
| 1234 | LM Studio API |
| 3080 | DSH web |
| 2222 | SSH → Debian |
| 9050 | Tor SOCKS (если поднят в госте) |

---

## 7. Типичные проблемы на Mac

| Симптом | Что проверить |
|---------|----------------|
| `lms: command not found` | LM Studio → настройки CLI / PATH; или полный путь к `lms` |
| SSH timeout на :2222 | VM запущена? Port forward в VirtualBox/UTM? `sshd` в госте? |
| Share пустой в госте | Guest Additions / virtio share; bind в `/mnt/hostshare` |
| `dsh` не стартует | `node -v` (нужен 22.19+ / 24+); `npm i -g @deepseek-ai/dsh` |
| Плагин всё ещё зовёт `.ps1` | `echo $VM_EXEC` должен быть `…/vm-exec.sh`; перезапусти `start-dsh.sh` |
| `/mnt/hostshare` на хосте | `host-mac/ensure-hostshare-link.sh` (может спросить sudo) |

---

## 8. Чеклист macOS

- [ ] Node ^22.19 / ≥24, `dsh` на PATH  
- [ ] LM Studio :1234, модель `coder`  
- [ ] Debian VM, SSH `2222`, share → `/mnt/hostshare`  
- [ ] `env.sh` + `./install.sh`  
- [ ] `vm-exec.sh 'uname'` → Linux  
- [ ] `start-dsh.sh` → :3080, новый чат, Write на share виден из bash  

Гостевой toolkit: `guest/TOOLKIT.md`.  
Общая архитектура стека: [README.md](./README.md) §3.
