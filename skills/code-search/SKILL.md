# Code search (Deep CLI)

Use semantic code index instead of reading whole files on large repos.

## When to use

- Project has 50+ source files
- Question is "where is X implemented?" or "how does Y work?"
- Grep returns huge output

## Commands (host workspace)

```bash
deep index build --name STACK
deep index search "authentication middleware" --name STACK
deep index status --name STACK
```

## Agent workflow

1. Run `deep index build` once per session (or rely on auto-incremental after writes).
2. Use `deep index search "<natural language query>"` before bulk Read/Grep.
3. Read only the 1–3 files/lines returned (path:startLine-endLine).

## Optional AST + LanceDB

For tree-sitter AST chunks and LanceDB vector store:

```bash
cd optional/code-index && npm install
```

Without optional deps: regex chunking + JSON store + hash/llama embeddings (still works).

## Index API

When stack is running: `DEEP_INDEX_URL` (default `http://127.0.0.1:<port>`).

POST `/search` `{ "query": "...", "limit": 8 }`
