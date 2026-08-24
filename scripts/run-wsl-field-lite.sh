#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export DEEP_NO_BANNER=1
REPO=/mnt/f/skagent/whoami/share/projects/deepseek-harness-tutorial-
cd "$REPO"

if ! command -v dsh >/dev/null 2>&1; then
  npm i -g --prefix "$HOME/.local" "@deepseek-ai/dsh@0.1.1-rc.2" || true
fi
# Prefer Linux dsh over Windows mount shim
if command -v dsh >/dev/null 2>&1; then
  case "$(command -v dsh)" in
    /mnt/c/*) npm i -g --prefix "$HOME/.local" "@deepseek-ai/dsh@0.1.1-rc.2" || true ;;
  esac
fi
export DEEP_DSH_BIN="${DEEP_DSH_BIN:-$HOME/.local/bin/dsh}"
export DEEP_HOME="${HOME}/.deep-field-lite"
rm -rf "$DEEP_HOME"
mkdir -p "$DEEP_HOME"

echo "=== WSL field-lite ==="
node scripts/field-lite.mjs
echo "=== readiness field ==="
node bin/deep.js doctor --readiness --stage=field
echo "=== OK ==="
