# Snapshot before reboot — 2026-08-23 ~21:30 MSK
# Restore with: <AI_SCRIPTS>\after-reboot-start.ps1

## Ports that were listening
| Port | Role | Process |
|------|------|---------|
| 1234 | LM Studio API | LM Studio.exe |
| 3080 | DSH web UI | node |
| 2222 | VM whoami SSH forward | VirtualBoxVM |
| 9050 | Tor SOCKS (VM forward) | VirtualBoxVM |

## VMs
- **Running:** `whoami` `{472e7ede-6fc4-417a-bfcb-aec0c2cc0338}`
- Present but usually stopped: whoami2 … whoami9

## Start order after reboot
1. VirtualBox → start **whoami** (or run after-reboot-start.ps1)
2. LM Studio → local server :1234 + model **coder** (`start-solo-max.ps1`)
3. DSH → `start-dsh.ps1` → http://127.0.0.1:3080
4. New chat in DSH (old sessions may be stale)

## Scripts
- `<AI_SCRIPTS>\after-reboot-start.ps1` — one-shot bring-up
- `<AI_SCRIPTS>\start-solo-max.ps1` — load coder
- `<AI_SCRIPTS>\start-dsh.ps1` — DSH web
- `<AI_SCRIPTS>\vm-exec.ps1` — bash into VM
