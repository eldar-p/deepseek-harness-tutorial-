---
name: qwen-coder
description: Local Qwen3-Coder via LM Studio + Cline. Coding only on VM whoami. Prefer VM tools over host speculation.
---

# Qwen3-Coder local (VM-only)

Model: LM Studio `http://127.0.0.1:1234/v1`. Context ~32K.

**All commands and installs run inside VM whoami.** Host Windows is only LM Studio + VirtualBox + files under `<VM_DIR>`.

## Workflow

1. Follow skill `vm-only` first.
2. Run bash via MCP `vbox_exec` / `vbox_ssh`, or `<AI_SCRIPTS>\vm-exec.ps1`.
3. Notes: `<AI_SCRIPTS>\knowledge`.
4. Tor/API/archives: `privacy-tor`, `onion`, `api`, `archives`, MCP `tor-net`.
5. Never host PowerShell for Linux work. Never host fetch/browser.
6. Show real command output.

## Style

- Working code over essays.
- Match user language (usually Russian).
- Edit in guest share when possible.
