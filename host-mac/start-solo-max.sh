#!/usr/bin/env bash
# Solo coder — one LM Studio model, max GPU (Metal).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/env.sh" ]] && source "$ROOT/env.sh"
[[ -f "$(dirname "$0")/env.sh" ]] && source "$(dirname "$0")/env.sh"

: "${LM_STUDIO_MODEL:?Set LM_STUDIO_MODEL in env.sh}"
CTX="${LM_STUDIO_CTX:-98304}"
ID="${LM_STUDIO_ID:-coder}"
export LM_STUDIO_API_KEY="${LM_STUDIO_API_KEY:-lm-studio}"

echo "=== Unload all ==="
lms unload --all 2>/dev/null || true
sleep 2

echo "=== Load $LM_STUDIO_MODEL ctx=$CTX id=$ID ==="
if lms load "$LM_STUDIO_MODEL" -c "$CTX" --gpu max --parallel 1 --identifier "$ID" -y; then
  echo "[OK] loaded"
else
  echo "[FAIL] lms load failed" >&2
  exit 1
fi
lms ps
echo "Next: host-mac/start-dsh.sh"
