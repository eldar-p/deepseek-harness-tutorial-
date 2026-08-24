#!/usr/bin/env bash
# Native Linux full-stack field helper (Ubuntu/Debian-like).
# Usage (from repo root, non-root user with docker group):
#   bash scripts/field-linux.sh [--gguf /path/model.gguf] [--name STACK]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${PATH}"
export GIM_NO_BANNER=1
export GIM_LLAMA_CTX="${GIM_LLAMA_CTX:-8192}"

STACK="os-audit-linux"
GGUF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) STACK="$2"; shift 2 ;;
    --gguf) GGUF="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

echo "=== field-linux stack=${STACK} ==="
command -v node
command -v docker || { echo "Docker required"; exit 1; }
if ! command -v dsh >/dev/null 2>&1; then
  echo "[INFO] Installing dsh into ~/.local …"
  npm i -g --prefix "${HOME}/.local" "@deepseek-ai/dsh@0.1.1-rc.2"
fi
export GIM_DSH_BIN="${GIM_DSH_BIN:-$(command -v dsh)}"

node bin/gim.js doctor --policy
node scripts/field-lite.mjs

if [[ -n "$GGUF" ]]; then
  node bin/gim.js bootstrap --name "$STACK" --gguf "$GGUF" --cpu || true
  node bin/gim.js start --name "$STACK" --gguf "$GGUF" --cpu
  node scripts/smoke-e2e.mjs --stack="$STACK"
  node bin/gim.js stop --name "$STACK" || true
else
  echo "[INFO] No --gguf — skipped start/e2e. Re-run with --gguf PATH for full GREEN."
fi

echo "=== field-linux done ==="
