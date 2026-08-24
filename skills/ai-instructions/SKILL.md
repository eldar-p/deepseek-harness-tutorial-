# AI instructions skill

When `.gim/ai-instructions.md` exists, **follow it** for build/test commands and project conventions.

## Commands

```bash
gim instructions init [--name STACK] [--force]
gim instructions refresh [--name STACK]
gim instructions sync [--name STACK] [--write-agents]
gim instructions show [--name STACK]
```

## Workflow

1. **init** — scaffold from template (bootstrap also seeds on first start)
2. **refresh** — rescan `package.json`, CI workflows, MCP servers, memory facts
3. **sync** — refresh + optional `AGENTS.md` in workspace root (`--write-agents`)

## Principles (agents.md style)

- Keep root file **short** (<200 lines); link to docs for detail
- Do not restate linter/typechecker rules — tools enforce those
- Update instructions when you change build/test entrypoints

## Agent loop

GIM injects `.gim/ai-instructions.md` into the system prompt automatically in agent/debug modes.
