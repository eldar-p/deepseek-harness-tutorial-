# Third-party components

Deep CLI project sources are **CC BY-NC-SA 4.0**. Integrations below keep their own licenses:

| Component | License | Use |
|-----------|---------|-----|
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | MIT | `llama-server` binaries (manifest fetch) |
| [@deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) | See npm | Optional web UI |
| Debian bookworm-slim | Debian policy | `Dockerfile.guest` base image |
| User GGUF models | **User responsibility** | Model license from publisher |

## Bundled in this repo (CC BY-NC-SA 4.0)

- `bin/`, `src/`, `dsh-plugins/`, `skills/`, `assets/`, `docs/` (project-authored) — CC BY-NC-SA 4.0 unless a file states otherwise
- Manifest URLs point to upstream releases; verify sha256 before trust

## Not included

- LM Studio, VirtualBox, Tor (legacy tutorial only)
- No telemetry SDKs in CLI source

Update this file when adding CDN artifacts or pinned dependencies.
