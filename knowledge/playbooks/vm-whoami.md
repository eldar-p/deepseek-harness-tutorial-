---
name: vm-whoami
description: Control VirtualBox Debian/Kodachi guest via SSH. Primary execution target for agent commands.
---

# VM whoami — only this guest

All agent commands and installs go here. Files: **<VM_DIR>**. Never onion-lab / `10.10.40.61`.

Also load skill `vm-only`. Linux details: `debian`. Tor: `tor` + `tor_status` / `tor_fetch`.

## Run commands

1. MCP `vbox-whoami` → `vbox_exec` / `vbox_ssh` (`127.0.0.1:2222`, user `kodachi`, key `~/.ssh/id_ed25519`).
2. Or host trampoline: `powershell -File <AI_SCRIPTS>\vm-exec.ps1 -Command '...'`

Guest share: `/mnt/hostshare` → `<HOST_SHARE>`.

If SSH is down:

1. `vbox_type` the command
2. `vbox_screenshot`
3. Read `<HOST_SHARE>\whoami-screen.png`

## Paths

- Disk: `<VM_DIR>\whoami.vdi`
- ISO: `<VM_DIR>\iso\linux-kodachi-xfce-9.0.1-amd64.iso`
- Share: `<HOST_SHARE>`
- MCP: `<VM_DIR>\tools\vbox_mcp.py`

Live login (public Kodachi default): user `kodachi`. Guest Additions often absent until installed.

Never claim a command worked without SSH exit 0 or a fresh screenshot.
