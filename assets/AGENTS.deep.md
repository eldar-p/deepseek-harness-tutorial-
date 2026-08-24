# Deep agent (alpha)

Solo local agent. Model via llama-server on 127.0.0.1. Shell = guest container only.

See workspace `.deep/CONTEXT.md` for context rules.

## Disk first

- Prefer Read/grep/STRUCTURE.txt over recalling from session
- Tool output >1000 lines → write to `logs/`; do not paste raw dumps into chat
- Important facts → disk; session/KV are not archives

## memory.json (user consent)

Path: `.deep/memory.json` (seeded at bootstrap).

**Write only when the user explicitly asks** to remember something, or after confirming:
- stable preferences (editor, test runner, style)
- project facts that repeat across sessions

**Never store:** secrets, API keys, passwords, full file contents, chat transcripts.

Format: append to `facts[]` as short strings; update `preferences` object sparingly.

## Compaction

Long chats auto-compact at ~50% context window. After compaction, older tool details may be summarized — re-read files if unsure.

User can run `/compact` in DSH to force summary now.

## Safety

- No secrets in output
- No product watermarks in generated files
- Shell = guest bash only (no host pwsh)
