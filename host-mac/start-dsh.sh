#!/usr/bin/env bash
# Start DeepSeek Harness web UI (local YOLO + LM Studio).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/env.sh" ]] && source "$ROOT/env.sh"
[[ -f "$HERE/env.sh" ]] && source "$HERE/env.sh"

: "${DSH_HOME:?DSH_HOME missing — run install.sh / set env.sh}"
: "${HOST_SHARE:?HOST_SHARE missing — set env.sh}"

export LM_STUDIO_API_KEY="${LM_STUDIO_API_KEY:-lm-studio}"
export DSH_PERMISSION_MODE="${DSH_PERMISSION_MODE:-danger-full-access}"
export VM_EXEC="${VM_EXEC:-$HERE/vm-exec.sh}"
export HOST_SHARE DSH_HOME

if [[ -f "$DSH_HOME/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$DSH_HOME/.env"
  set +a
fi

mkdir -p "$DSH_HOME"
if [[ -x "$HERE/ensure-hostshare-link.sh" ]]; then
  "$HERE/ensure-hostshare-link.sh" || true
fi

DSH_BIN="${DSH_BIN:-dsh}"
echo "UI=http://127.0.0.1:3080  LM Studio=http://127.0.0.1:1234/v1"
echo "HOST_SHARE=$HOST_SHARE  permission=$DSH_PERMISSION_MODE  VM_EXEC=$VM_EXEC"
cd "$HOST_SHARE"
exec "$DSH_BIN" web --no-open --port 3080
