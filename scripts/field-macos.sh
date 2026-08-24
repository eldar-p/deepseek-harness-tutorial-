#!/usr/bin/env bash
# macOS full-stack field helper (Apple Silicon / Intel).
# Usage (from repo root):
#   bash scripts/field-macos.sh [--gguf /path/model.gguf] [--name STACK]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
export DEEP_NO_BANNER=1
export DEEP_LLAMA_CTX="${DEEP_LLAMA_CTX:-8192}"

STACK="os-audit-macos"
GGUF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) STACK="$2"; shift 2 ;;
    --gguf) GGUF="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

echo "=== field-macos stack=${STACK} arch=$(uname -m) ==="
command -v node
# Docker Desktop optional for field-lite; required for guest e2e
if command -v docker >/dev/null 2>&1; then
  docker info >/dev/null 2>&1 && echo "[OK] Docker" || echo "[WARN] Docker installed but daemon not ready"
else
  echo "[WARN] Docker not found — guest smoke will be skipped"
fi

if ! command -v dsh >/dev/null 2>&1; then
  echo "[INFO] Installing dsh into ~/.local …"
  npm i -g --prefix "${HOME}/.local" "@deepseek-ai/dsh@0.1.1-rc.2"
fi
export DEEP_DSH_BIN="${DEEP_DSH_BIN:-$(command -v dsh)}"

node bin/deep.js doctor --policy
node scripts/field-lite.mjs

if [[ -n "$GGUF" ]]; then
  node bin/deep.js bootstrap --name "$STACK" --gguf "$GGUF" || true
  # Metal preferred when discrete GPU path available; omit --cpu on Apple Silicon
  if [[ "$(uname -m)" == "arm64" ]]; then
    node bin/deep.js start --name "$STACK" --gguf "$GGUF"
  else
    node bin/deep.js start --name "$STACK" --gguf "$GGUF" --cpu
  fi
  node scripts/smoke-e2e.mjs --stack="$STACK"
  node bin/deep.js stop --name "$STACK" || true
else
  echo "[INFO] No --gguf — skipped start/e2e. Re-run with --gguf PATH for full GREEN."
fi

echo "=== field-macos done ==="
