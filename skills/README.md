# GIM agent skills

Skills are copied to `~/.gim/dsh-home/skills/` on `gim bootstrap` (optional DSH) and guide the **native GIM UI agent** on long tasks.

**Product context (2.0):** Colibri Docker default · workspace jail · six fixed tools · no host shell.

| Skill | Use when |
|-------|----------|
| [gim-workspace](./gim-workspace/SKILL.md) | Paths, stack layout, six tools, guest vs host |
| [agent-speed](./agent-speed/SKILL.md) | Fast turns — search before read, limits, warm LLM |
| [search-large-files](./search-large-files/SKILL.md) | Huge files — pattern first, read a window |
| [code-search](./code-search/SKILL.md) | Semantic index on 50+ file repos |
| [lsp](./lsp/SKILL.md) | Go-to-def / refs via language servers |
| [tool-search](./tool-search/SKILL.md) | Deferred catalog — search before guessing CLI/MCP |
| [ai-instructions](./ai-instructions/SKILL.md) | `.gim/ai-instructions.md` — project context for agent |
| [large-project](./large-project/SKILL.md) | Multi-module apps under workspace |
| [frontend-ui](./frontend-ui/SKILL.md) | Non-default HTML/CSS (not bare blue links) |
| [network-egress](./network-egress/SKILL.md) | Guest outbound HTTP — presets, proxy, allowlist |
| [gim-security](./gim-security/SKILL.md) | Jail, risk deny, secrets, network WARN |

Canonical product rules: [docs/PRINCIPLES.md](../docs/PRINCIPLES.md) · speed: [docs/SPEED.md](../docs/SPEED.md).
