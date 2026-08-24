#!/usr/bin/env bash
# WSL Ubuntu field helper. Prefer Docker Desktop WSL integration.
# Usage:
#   bash scripts/field-linux-wsl.sh [--gguf /path/model.gguf] [--repo /path/to/gim-cli]
set -euo pipefail

REPO="${GIM_REPO:-}"
GGUF=""
STACK="os-audit-wsl"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --gguf) GGUF="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --name) STACK="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 2 ;;
  esac
done

if [[ -z "$REPO" ]]; then
  REPO="$(cd "$(dirname "$0")/.." && pwd)"
fi
# If invoked from Windows mount, allow override
if [[ ! -f "$REPO/bin/gim.js" ]]; then
  echo "Repo not found at $REPO — pass --repo"
  exit 2
fi

cd "$REPO"
export PATH="${HOME}/.local/bin:${PATH}"
export GIM_NO_BANNER=1
export GIM_LLAMA_CTX="${GIM_LLAMA_CTX:-8192}"

# Reject Windows npm shim for dsh (any /mnt/<drive>/…, not only C:)
if command -v dsh >/dev/null 2>&1 && file "$(command -v dsh)" 2>/dev/null | grep -qi 'windows\|PE32'; then
  echo "[WARN] dsh looks like a Windows binary — install Linux build:"
  echo "  npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2"
fi
DSH_BIN="$(command -v dsh 2>/dev/null || true)"
if [[ -z "$DSH_BIN" || "$DSH_BIN" == /mnt/[a-zA-Z]/* ]]; then
  npm i -g --prefix "${HOME}/.local" "@deepseek-ai/dsh@0.1.1-rc.2"
fi
export GIM_DSH_BIN="${GIM_DSH_BIN:-${HOME}/.local/bin/dsh}"

if ! docker info >/dev/null 2>&1; then
  echo "[WARN] docker not ready — prefer Docker Desktop WSL integration (Settings → Resources → WSL)"
fi

echo "=== field-linux-wsl ==="
node bin/gim.js doctor --policy
node scripts/field-lite.mjs

ARGS=(bash scripts/field-linux.sh --name "$STACK")
if [[ -n "$GGUF" ]]; then
  ARGS+=(--gguf "$GGUF")
fi
exec "${ARGS[@]}"
