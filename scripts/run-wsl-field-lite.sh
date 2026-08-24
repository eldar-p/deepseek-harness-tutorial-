#!/usr/bin/env bash
# WSL field-lite — no hardcoded Windows mount path.
# Usage: bash scripts/run-wsl-field-lite.sh [--repo /path/to/gim-cli]
set -euo pipefail

REPO="${GIM_REPO:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 2 ;;
  esac
done
if [[ -z "$REPO" ]]; then
  REPO="$(cd "$(dirname "$0")/.." && pwd)"
fi
if [[ ! -f "$REPO/bin/gim.js" ]]; then
  echo "Repo not found at $REPO — pass --repo /path/to/gim-cli"
  exit 2
fi

export PATH="$HOME/.local/bin:$PATH"
export GIM_NO_BANNER=1
cd "$REPO"

ensure_linux_dsh() {
  local bin=""
  if command -v dsh >/dev/null 2>&1; then
    bin="$(command -v dsh)"
  fi
  # Reject any Windows drive mount shim (/mnt/c, /mnt/f, …)
  if [[ -z "$bin" || "$bin" == /mnt/[a-zA-Z]/* ]]; then
    echo "[INFO] Installing Linux dsh under ~/.local …"
    npm i -g --prefix "$HOME/.local" "@deepseek-ai/dsh@0.1.1-rc.2" || true
  elif file "$bin" 2>/dev/null | grep -qi 'windows\|PE32'; then
    echo "[WARN] dsh looks like Windows PE — reinstalling Linux build"
    npm i -g --prefix "$HOME/.local" "@deepseek-ai/dsh@0.1.1-rc.2" || true
  fi
}
ensure_linux_dsh
export GIM_DSH_BIN="${GIM_DSH_BIN:-$HOME/.local/bin/dsh}"

if ! docker info >/dev/null 2>&1; then
  echo "[WARN] docker not ready in WSL — enable Docker Desktop → Settings → Resources → WSL integration"
fi

export GIM_HOME="${HOME}/.gim-field-lite"
rm -rf "$GIM_HOME"
mkdir -p "$GIM_HOME"

echo "=== WSL field-lite (repo=$REPO) ==="
node scripts/field-lite.mjs
echo "=== readiness field ==="
node bin/gim.js doctor --readiness --stage=field
echo "=== OK ==="
