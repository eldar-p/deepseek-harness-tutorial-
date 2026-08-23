#!/usr/bin/env bash
# Install this repo into DSH_HOME + HOST_SHARE (macOS / Linux).
#   cp env.sh.example env.sh && edit
#   ./install.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/env.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/env.sh.example" "$ENV_FILE"
  echo "Created env.sh — edit paths, then re-run ./install.sh"
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${DSH_HOME:?}"
: "${HOST_SHARE:?}"

PROFILE_NAME="${DSH_PROFILE:-web}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE_NAME"
PLUGIN_DST="$PROFILE_DIR/dsh-plugins"
SKILLS_DST="$DSH_HOME/skills"
GUEST_DST="$HOST_SHARE/guest-toolkit"
AI_DST="$HOST_SHARE/ai"
VM_MOUNT="${VM_MOUNT:-/mnt/hostshare}"

mkdir -p "$DSH_HOME" "$PROFILE_DIR" "$PLUGIN_DST" "$SKILLS_DST" "$HOST_SHARE" "$GUEST_DST" "$AI_DST"

rsync -a "$ROOT/dsh-plugins/" "$PLUGIN_DST/"
rsync -a "$ROOT/skills/" "$SKILLS_DST/"
rsync -a "$ROOT/guest/" "$GUEST_DST/"
rsync -a "$ROOT/host-mac/" "$AI_DST/"
cp "$ENV_FILE" "$AI_DST/env.sh"
chmod +x "$AI_DST"/*.sh 2>/dev/null || true
chmod +x "$GUEST_DST"/*.sh 2>/dev/null || true

if [[ -f "$ROOT/config/.clinerules" ]]; then
  cp "$ROOT/config/.clinerules" "$DSH_HOME/.clinerules"
  cp "$ROOT/config/.clinerules" "$HOST_SHARE/.clinerules"
fi

if [[ ! -f "$DSH_HOME/settings.yaml" ]]; then
  cp "$ROOT/config/settings.yaml" "$DSH_HOME/settings.yaml"
fi

PLUGIN_BASE="$PLUGIN_DST"
# file:// URLs: encode spaces if any; use absolute path
PLUGIN_URI="$PLUGIN_DST"

sed -e "s|<HOST_SHARE>|$HOST_SHARE|g" \
    -e "s|<VM_MOUNT>|$VM_MOUNT|g" \
    "$ROOT/config/AGENTS.md" > "$DSH_HOME/AGENTS.md"
cp "$DSH_HOME/AGENTS.md" "$HOST_SHARE/AGENTS.md"
cp "$DSH_HOME/AGENTS.md" "$GUEST_DST/AGENTS.md"

sed -e "s|__PLUGIN_DIR__|$PLUGIN_URI|g" \
    -e "s|__HOST_SHARE__|$HOST_SHARE|g" \
    -e "s|__VM_MOUNT__|$VM_MOUNT|g" \
    "$ROOT/config/cordis.patch.yml" > "$PROFILE_DIR/cordis.patch.yml"

# Persist VM_EXEC for DSH process (also set in start-dsh.sh)
grep -q '^export VM_EXEC=' "$ENV_FILE" 2>/dev/null || \
  echo "export VM_EXEC=\"$AI_DST/vm-exec.sh\"" >> "$ENV_FILE"

echo "[OK] DSH_HOME=$DSH_HOME"
echo "     plugins = $PLUGIN_DST"
echo "     skills  = $SKILLS_DST"
echo "     guest   = $GUEST_DST"
echo "     host ai = $AI_DST"
echo "Next: host-mac/start-solo-max.sh then host-mac/start-dsh.sh"
echo "Docs: MACOS.md"
