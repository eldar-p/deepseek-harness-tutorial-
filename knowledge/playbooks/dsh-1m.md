---
name: dsh-1m
description: DeepSeek Harness with 1M context via official DeepSeek API. Use when the user mentions dsh, DeepSeek Harness, 1M context, million tokens, or DeepSeek V4.
---

# 1M context = DeepSeek Harness, not GGUF

Do **not** download Unsloth/YaRN GGUF for 1M. Local Qwen GGUF stays at 32K (native max 256K). The million-token window is DeepSeek V4 through Harness:

- Flash: `deepseek-v4-flash` (1,000,000)
- Pro: `deepseek-v4-pro` (1,000,000)

Start: `powershell -File <AI_SCRIPTS>\start-dsh.ps1` → http://127.0.0.1:3080

Home: `<DSH_HOME>` (`settings.yaml`, `.credentials.yaml`).

If the UI says missing key: Settings → Models, paste `DEEPSEEK_API_KEY` from https://platform.deepseek.com/. Do not put the key in chat.

This path sends code to DeepSeek's servers (not Tor). Local Cline/LM Studio remains the private 32K coder.
