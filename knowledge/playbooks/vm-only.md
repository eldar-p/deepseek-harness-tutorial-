---
name: vm-only
description: Hard rule — all work and shell commands run only inside VirtualBox VM whoami via SSH/MCP. Use for every task; never run apt/git/curl/python on the Windows host.
---

# VM-only execution (hard rule)

The Windows host is **not** a workspace. The only machine you may change or run commands on is VM **whoami**.

## Commands

1. Prefer MCP `vbox-whoami` → `vbox_exec` / `vbox_ssh` (bash in the guest).
2. If you must use the host terminal, the **only** allowed form is:

```powershell
powershell -File <AI_SCRIPTS>\vm-exec.ps1 -Command 'YOUR_BASH_HERE'
```

Examples:

```powershell
powershell -File <AI_SCRIPTS>\vm-exec.ps1 -Command 'uname -a && pwd'
powershell -File <AI_SCRIPTS>\vm-exec.ps1 -Command 'cd /mnt/hostshare && ls -la'
```

## Forbidden on Windows host

- `apt`, `apt-get`, `systemctl`, `python`, `pip`, `npm`, `git`, `curl`, `wget` as host commands
- PowerShell for project work (`Get-ChildItem`, `Invoke-WebRequest`, …)
- Built-in browser / clearnet fetch MCP
- Any SSH target other than `127.0.0.1:2222` / `kodachi@127.0.0.1`
- onion-lab / `10.10.40.61`

## Files

- Guest work dir: `/home/kodachi` or `/mnt/hostshare` (host: `<HOST_SHARE>`)
- Durable AI notes/scripts: `<AI_SCRIPTS>` ↔ guest `/mnt/hostshare/ai` if linked
- Read host files under `<VM_DIR>` only when needed; edits for the project belong in the guest share

## Network

All internet from the guest through Tor (`tor-net` MCP / `privacy-tor` skill). Never host DuckDuckGo/fetch/browser.

## Proof

Never claim success without `vbox_exec` / `vm-exec.ps1` exit output.
