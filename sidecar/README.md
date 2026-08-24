# GIM index sidecar (future)

Optional native binary **`gim-index`** for large workspaces (100k+ chunks). GIM core stays JS; sidecar replaces only the hot search/build path.

## HTTP contract (localhost)

Same as `src/code-index/server.js`:

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/status` | — | `{ backend, chunkCount, fileCount, builtAt, ... }` |
| POST | `/build` | `{}` | build stats |
| POST | `/search` | `{ query, limit? }` | `{ ok, hits, backend }` |
| POST | `/touch` | `{ path }` | `{ ok, path }` |

Env: `GIM_INDEX_URL=http://127.0.0.1:PORT` (stack coordinator sets this when sidecar is enabled).

## On-disk layout

Unchanged — read/write under `<workspace>/.gim/code-index/`:

- `meta.json`, `files.json`, `chunks.json`, optional `lance/`

## Rollout

1. Ship sidecar as optional download (manifest pin + sha256).
2. `gim start` probes binary; falls back to JS indexer if missing.
3. No per-OS logic in harness — one sidecar binary per platform in manifest.

Until then: JS incremental index + Worker cosine (`docs/CODE-INDEX.md`).
