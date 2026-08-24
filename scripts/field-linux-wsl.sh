#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export DEEP_NO_BANNER=1
export DEEP_LLAMA_CTX=8192
export DEEP_DSH_BIN="$HOME/.local/bin/dsh"
OUT=/tmp/deep-linux-field.txt
{
  echo "=== env ==="
  command -v dsh || true
  command -v docker || true
  "$HOME/.local/bin/dsh" --version || true
  docker images deep-guest:0.2-beta || true
  cd "$HOME/deep-audit"
  # sync hot fixes from Windows mount
  cp -a /mnt/f/skagent/whoami/share/projects/deepseek-harness-tutorial-/src/dsh.js src/
  cp -a /mnt/f/skagent/whoami/share/projects/deepseek-harness-tutorial-/src/guest.js src/
  cp -a /mnt/f/skagent/whoami/share/projects/deepseek-harness-tutorial-/src/llama.js src/
  cp -a /mnt/f/skagent/whoami/share/projects/deepseek-harness-tutorial-/manifests/llama-binaries.json manifests/
  cp -a /mnt/f/skagent/whoami/share/projects/deepseek-harness-tutorial-/scripts/audit-run.mjs scripts/
  echo "=== start ==="
  node bin/deep.js start --name os-audit-linux --cpu || true
  echo "=== e2e ==="
  node scripts/smoke-e2e.mjs --stack=os-audit-linux || true
  echo "=== probe ==="
  node scripts/ai-field-probe.mjs --stack=os-audit-linux || true
  echo "=== stop ==="
  node bin/deep.js stop --name os-audit-linux || true
} >"$OUT" 2>&1
cat "$OUT"
