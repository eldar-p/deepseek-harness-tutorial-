# Project instructions (GIM)

> Baseline for the coding agent. Edit freely.
> Refresh commands: `gim instructions refresh`
> Sync with AGENTS.md: `gim instructions sync --write-agents`

## Overview

<!-- one-line project description -->

## Commands

| Task | Command |
|------|---------|
| test | *(run `gim instructions refresh` to detect)* |

## Conventions

- Prefer small, focused diffs
- Run tests before declaring done
- Do not commit secrets

## GIM workspace

- Context rules: `.gim/CONTEXT.md`
- Memory (user consent): `.gim/memory.json`
- MCP servers: `gim mcp client list`

## Security

- Shell runs in **guest container** only
- No secrets in chat, logs, or memory
