#!/usr/bin/env bash
# macOS field helper — guest + GGUF only (LLM Docker not supported on macOS).
# Usage: bash scripts/field-macos.sh [--gguf /path/model.gguf] [--name STACK]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
export GIM_NO_BANNER=1
export GIM_CTX="${GIM_CTX:-512000}"
export GIM_LLAMA_CTX="${GIM_LLAMA_CTX:-512000}"

STACK="os-audit-macos"
GGUF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) STACK="$2"; shift 2 ;;
    --gguf) GGUF="$2"; shift 2 ;;
    --colibri|--vllm)
      echo "[ERROR] LLM Docker (--colibri/--vllm) is Win/Linux only. On macOS use --gguf or gim start --api."
      exit 2
      ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

echo "=== field-macos stack=${STACK} arch=$(uname -m) ctx=${GIM_CTX} ==="
command -v node
if command -v docker >/dev/null 2>&1; then
  docker info >/dev/null 2>&1 && echo "[OK] Docker" || echo "[WARN] Docker installed but daemon not ready"
else
  echo "[WARN] Docker not found — guest smoke will be skipped"
fi

if ! command -v dsh >/dev/null 2>&1; then
  echo "[INFO] Installing dsh into ~/.local …"
  npm i -g --prefix "${HOME}/.local" "@deepseek-ai/dsh@0.1.1-rc.2"
fi
export GIM_DSH_BIN="${GIM_DSH_BIN:-$(command -v dsh)}"

node bin/gim.js doctor --policy
node scripts/field-lite.mjs

if [[ -n "$GGUF" ]]; then
  node bin/gim.js bootstrap --name "$STACK" --gguf "$GGUF" || true
  if [[ "$(uname -m)" == "arm64" ]]; then
    node bin/gim.js start --name "$STACK" --gguf "$GGUF"
  else
    node bin/gim.js start --name "$STACK" --gguf "$GGUF" --cpu
  fi
  node scripts/smoke-e2e.mjs --stack="$STACK"
  node bin/gim.js stop --name "$STACK" || true
else
  echo "[INFO] No --gguf — skipped start/e2e. Use --gguf PATH or cloud --api on macOS."
fi

echo "=== field-macos done ==="
