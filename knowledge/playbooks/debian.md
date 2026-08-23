---
name: debian
description: Work as a Debian (Kodachi/Trixie) admin on VM whoami. Use for apt, systemd, bash, Linux files, Python on the guest, services, and any task that belongs on Linux rather than Windows.
---

# Debian workspace (VM whoami)

Linux work happens **inside** VirtualBox VM `whoami`, not in Windows PowerShell.

- Distro: Kodachi 9.0.1, `ID_LIKE=debian`, codename **trixie** (Debian 13)
- User: `kodachi` (passwordless `sudo`)
- Shell: bash
- SSH: `127.0.0.1:2222` via MCP `vbox-whoami` → `vbox_exec` / `vbox_ssh`
- Disk/share on host: `<VM_DIR>` → guest `/mnt/hostshare`
- Do **not** use onion-lab / `10.10.40.61`

## How to run commands

Always `vbox_exec` with **bash**. Never PowerShell syntax (`Get-ChildItem`, `;` instead of `&&` is Windows-only).

```bash
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y <pkg>
systemctl status <unit> --no-pager
```

Live ISO: packages installed in the overlay vanish after reboot unless installed to `whoami.vdi`. Prefer putting durable files on `/mnt/hostshare` (the F: share).

## Layout

| Place | Use |
|--------|-----|
| `/home/kodachi` | guest home (RAM overlay on live) |
| `/mnt/hostshare` | persistent on host F: |
| `/mnt/hostshare/ai` | AI playbooks, scripts |
| `<VM_DIR>` | host copy of the same tree |

## apt

- `apt-get` (scripts) / `apt` (interactive). Never `yum`/`pacman`/`brew` here.
- Noninteractive: `DEBIAN_FRONTEND=noninteractive`
- If clearnet is blocked, install **through Tor** (`tor` skill): `torsocks sudo apt-get update`

## systemd

`systemctl start|stop|status|restart --no-pager`. Logs: `journalctl -u NAME -n 50 --no-pager`.

## Don't

- Don't run Debian commands on the Windows host.
- Don't SSH to any other machine for this VM.
- Don't claim success without the `vbox_exec` / SSH output.
