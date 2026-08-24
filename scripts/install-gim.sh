# Pre-alpha local install (no CDN yet)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PREFIX="${PREFIX:-$HOME/.local/bin}"
CHANNEL="${CHANNEL:-stable}"
DRY=0
LOG="$ROOT/install.log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix=*) PREFIX="${1#*=}" ;;
    --channel=*) CHANNEL="${1#*=}" ;;
    --dry-run) DRY=1 ;;
    --help|-h) echo "Usage: ./install.sh [--prefix=DIR] [--channel=stable|beta|edge] [--dry-run]"; exit 0 ;;
    *) echo "Unknown: $1"; exit 2 ;;
  esac
  shift
done

log() { echo "$(date -Iseconds) $*" | tee -a "$LOG"; }

log "start channel=$CHANNEL prefix=$PREFIX dry=$DRY os=$(uname -s) arch=$(uname -m)"
command -v node >/dev/null || { log "FAIL node missing"; exit 1; }
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 22 ]]; then log "FAIL need Node >=22"; exit 1; fi

mkdir -p "$PREFIX"
TARGET="$PREFIX/gim"
if [[ "$DRY" -eq 1 ]]; then
  log "dry-run would link $ROOT/bin/gim.js -> $TARGET"
  exit 0
fi

ln -sfn "$ROOT/bin/gim.js" "$TARGET"
chmod +x "$ROOT/bin/gim.js" "$TARGET"
log "linked $TARGET"
log "run: gim bootstrap && gim doctor"
chmod 600 "$LOG" 2>/dev/null || true
