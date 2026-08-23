#!/usr/bin/env bash
# Symlink for hallucinated paths like /mnt/hostshare → real HOST_SHARE
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/env.sh" ]] && source "$ROOT/env.sh"
[[ -f "$(dirname "$0")/env.sh" ]] && source "$(dirname "$0")/env.sh"

SHARE="${HOST_SHARE:?HOST_SHARE not set}"
LINK="${HOSTSHARE_LINK:-/mnt/hostshare}"

mkdir -p "$(dirname "$LINK")" 2>/dev/null || true
if [[ -L "$LINK" ]]; then
  echo "[OK] symlink exists: $LINK -> $(readlink "$LINK")"
  exit 0
fi
if [[ -e "$LINK" ]]; then
  echo "[FAIL] $LINK exists and is not a symlink" >&2
  exit 1
fi
# May need sudo for /mnt
if ln -s "$SHARE" "$LINK" 2>/dev/null; then
  echo "[OK] $LINK → $SHARE"
else
  sudo ln -s "$SHARE" "$LINK"
  echo "[OK] $LINK → $SHARE (sudo)"
fi
