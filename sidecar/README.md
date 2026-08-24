# GIM index sidecar

Optional native binary **`gim-index`** for large workspaces (100k+ chunks). GIM core stays JS; sidecar replaces only the hot search/build path.

## Build native (MVP)

```bash
cd sidecar/gim-index
cargo build --release
# binary: target/release/gim-index (or gim-index.exe on Windows)
GIM_INDEX_SIDECAR=/path/to/gim-index gim index sidecar
```

MVP scope: **GET /status**, **POST /search**, **POST /touch** (regex chunk + shard). Build via `gim index build` or **POST /build** on JS sidecar.

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

- `meta.json`, `files.json`, `chunks.json`, `shards/*.json`, optional `lance/`

## Rollout

1. Ship sidecar as optional download (`manifests/index-sidecar.json` pin + sha256).
2. `gim start` / `spawnCodeIndexService` probes native binary; falls back to JS (`scripts/gim-index-sidecar.mjs`).
3. No per-OS logic in harness — manifest row per platform.

### Native CLI (when binary ships)

```bash
gim-index --port 14150 --workspace /path/to/workspace [--llama-url http://127.0.0.1:18000/v1]
```

Env equivalent: `GIM_INDEX_PORT`, `GIM_WORKSPACE`, `GIM_LLAMA_URL`.

### GIM commands

```bash
gim index sidecar          # backend js|native, manifest pin status
GIM_INDEX_SIDECAR=js       # force JS
GIM_INDEX_SIDECAR=/path/to/gim-index   # explicit native binary
```

Until native ships: JS incremental index + Worker cosine (`docs/CODE-INDEX.md`).
