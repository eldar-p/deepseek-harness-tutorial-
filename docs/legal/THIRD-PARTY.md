# Third-party components

GIM CLI project sources are **Apache-2.0**. Integrations below keep their own licenses:

| Component | License | Use |
|-----------|---------|-----|
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | MIT | `llama-server` binaries (manifest fetch) |
| [Colibri](https://github.com/JustVugg/colibri) | Apache-2.0 | Optional LLM host (submodule / upstream; **not** vendored C in npm package) |
| [@deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) | See npm | Optional web UI |
| Debian bookworm-slim | Debian policy | `Dockerfile.guest` base image |
| User GGUF models | **User responsibility** | Model license from publisher |

## Bundled in this repo (Apache-2.0)

- `bin/`, `src/`, `dsh-plugins/`, `skills/`, `assets/`, `docs/` (project-authored) — Apache-2.0 unless a file states otherwise
- Manifest URLs point to upstream releases; verify sha256 before trust

## Not included in npm package

- LM Studio, VirtualBox (removed legacy tutorial)
- No telemetry SDKs in CLI source

Update this file when adding CDN artifacts or pinned dependencies.
