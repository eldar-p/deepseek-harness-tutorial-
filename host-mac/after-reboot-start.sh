#!/usr/bin/env bash
# After reboot: wait SSH → load coder → start DSH
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/env.sh" ]] && source "$ROOT/env.sh"
[[ -f "$HERE/env.sh" ]] && source "$HERE/env.sh"

wait_port() {
  local port="$1" secs="${2:-90}"
  local i=0
  while (( i < secs )); do
    if nc -z 127.0.0.1 "$port" 2>/dev/null || \
       (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
      return 0
    fi
    sleep 1
    ((i++)) || true
  done
  return 1
}

echo "=== 1) SSH :2222 ==="
if wait_port 2222 120; then
  echo "[OK] SSH listening"
else
  echo "[WARN] Start your Debian VM (VirtualBox/UTM) and wait for SSH :2222"
fi

if wait_port 9050 15; then
  echo "[OK] Tor :9050"
else
  echo "[WARN] Tor :9050 not up yet"
fi

echo "=== 2) LM Studio model ==="
"$HERE/start-solo-max.sh"

echo "=== 3) DSH ==="
if wait_port 3080 3; then
  echo "[OK] DSH already on :3080"
else
  nohup "$HERE/start-dsh.sh" >"${TMPDIR:-/tmp}/dsh-web.log" 2>&1 &
  if wait_port 3080 60; then
    echo "[OK] http://127.0.0.1:3080"
  else
    echo "[FAIL] DSH — see ${TMPDIR:-/tmp}/dsh-web.log" >&2
    exit 1
  fi
fi

echo "Open a NEW chat in the UI."
