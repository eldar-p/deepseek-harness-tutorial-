# Code Index

Semantic search over workspace source files. Default backend: **JSON + hash embed** (no native deps). Optional: LanceDB + llama `/v1/embeddings` + tree-sitter (`optional/code-index/`).

## Commands

```bash
gim index build [--name default] [--force]
gim index search "auth token login" [--name default] [--limit 8]
gim index status [--name default]
```

| Env | Effect |
|-----|--------|
| `GIM_INDEX_FULL=1` | Full rebuild (ignore `files.json` hashes) |
| `GIM_INDEX_WORKER_MIN` | Min chunks before cosine runs in Worker (default `500`) |

## On-disk layout

`~/.gim/workspace/<stack>/.gim/code-index/`:

| File | Purpose |
|------|---------|
| `meta.json` | Backend, `chunkCount`, `builtAt`, incremental stats — **loaded by `status`** |
| `files.json` | `{ "path/to/file.js": { "hash", "mtime" } }` — incremental index |
| `chunks.json` | All chunks + vectors — **loaded only on search** |
| `lance/` | Optional LanceDB tables |

## Incremental build

1. Walk workspace (`listSourceFiles`, max 5000 files, skip `node_modules`, `.gim`, etc.).
2. For each file: SHA-256 content hash (16 hex chars).
3. If hash matches `files.json` → reuse existing chunks, skip embed.
4. Changed/new files → chunk + embed only those.
5. Deleted files → dropped from `files.json` and chunks.

Single-file updates after agent writes: `indexFile()` (HTTP `POST /touch` on index server).

## Search pipeline

1. Read `meta.json` (cheap).
2. Load `chunks.json` (heavy — only here).
3. Embed query (`hashEmbed` or llama embeddings).
4. Cosine similarity:
   - &lt; `GIM_INDEX_WORKER_MIN` chunks → main thread
   - ≥ threshold → **Worker Thread** (`search-worker.js`) with flat `Float32Array` matrix

## HTTP API (DSH plugin)

Started with stack (`code-index/server.js`), localhost only:

- `GET /status` — lazy meta
- `POST /build` — incremental build
- `POST /search` — `{ query, limit? }`
- `POST /touch` — `{ path }` re-index one file

## Future: Rust sidecar

When JSON + Worker is not enough (100k+ chunks), replace search/build hot path with native `gim-index` binary; keep same directory layout and HTTP contract.
