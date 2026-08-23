#!/usr/bin/env bash
# Run bash inside the Debian VM over SSH (never on the Mac host).
# Usage: ./vm-exec.sh 'uname -a'
# Env: VM_SSH_HOST VM_SSH_PORT VM_SSH_USER VM_SSH_KEY

set -euo pipefail

HOST="${VM_SSH_HOST:-127.0.0.1}"
PORT="${VM_SSH_PORT:-2222}"
USER="${VM_SSH_USER:-kodachi}"
KEY="${VM_SSH_KEY:-$HOME/.ssh/id_ed25519}"
TIMEOUT="${VM_EXEC_TIMEOUT:-7200}"

if [[ ! -f "$KEY" ]]; then
  echo "SSH key missing: $KEY" >&2
  exit 1
fi

cmd="${*:-}"
if [[ -z "$cmd" ]]; then
  echo "Empty command. Usage: $0 'ls -la'" >&2
  exit 1
fi
if [[ "$cmd" == --* ]]; then
  cmd="${cmd#-- }"
fi

# Escape for remote bash -lc '...'
q="${cmd//\'/\'\\\'\'}"

exec ssh \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o LogLevel=ERROR \
  -o ConnectTimeout=8 \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=120 \
  -i "$KEY" \
  -p "$PORT" \
  "${USER}@${HOST}" \
  "bash -lc '$q'"
