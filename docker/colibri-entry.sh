#!/bin/sh
# Universal Colibri entry — speed env from host; no model-specific logic.
set -eu

COLI="${COLI_BIN:-/colibri/coli}"
MODEL="${COLI_MODEL:-/model}"
HOST="${COLI_HOST:-0.0.0.0}"
PORT="${COLI_PORT:-8000}"
CTX="${COLI_CTX:-512000}"
RAM="${COLI_RAM:-48}"
MODEL_ID="${COLI_MODEL_ID:-default}"
KV_SLOTS="${COLI_KV_SLOTS:-8}"
XDG="${GIM_XDG_CACHE:-/gim-cache/xdg}"

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$XDG/config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$XDG/cache}"

mkdir -p "$XDG_CONFIG_HOME/colibri/tuning" "$XDG_CACHE_HOME" "${GIM_CACHE_MIRROR:-/gim-cache/mirror}" /gim-cache/markers

# Mirror learning files into gim cache when model dir is writable
if [ -d "${GIM_CACHE_MIRROR:-/gim-cache/mirror}" ]; then
  for f in .coli_usage .coli_kv; do
    if [ -f "$MODEL/$f" ] && [ ! -f "${GIM_CACHE_MIRROR}/$f" ]; then
      cp -a "$MODEL/$f" "${GIM_CACHE_MIRROR}/$f" 2>/dev/null || true
    fi
    if [ -f "${GIM_CACHE_MIRROR}/$f" ] && [ ! -f "$MODEL/$f" ]; then
      cp -a "${GIM_CACHE_MIRROR}/$f" "$MODEL/$f" 2>/dev/null || true
    fi
  done
fi

if [ ! -x "$COLI" ] && [ ! -f "$COLI" ]; then
  echo "colibri-entry: missing Linux coli at $COLI — mount GIM_COLIBRI_ROOT" >&2
  exit 1
fi
if [ ! -f "$MODEL/config.json" ]; then
  echo "colibri-entry: model config.json not found under $MODEL" >&2
  exit 1
fi

# Optional one-shot hardware tune (P2)
if [ "${GIM_COLIBRI_AUTO_TUNE:-0}" = "1" ] && [ ! -f "/gim-cache/markers/coli-tune.done" ]; then
  if "$COLI" tune --model "$MODEL" 2>/dev/null; then
    mkdir -p /gim-cache/markers
    date -Iseconds > /gim-cache/markers/coli-tune.done
    echo "colibri-entry: coli tune completed"
  else
    echo "colibri-entry: coli tune skipped (CLI may not support tune yet)"
  fi
fi

EXTRA=""
if [ "${COLI_AUTO_TIER:-0}" = "1" ] || [ "${GIM_COLIBRI_AUTO_TIER:-0}" = "1" ]; then
  EXTRA="--auto-tier"
fi

exec "$COLI" serve \
  --model "$MODEL" \
  --host "$HOST" \
  --port "$PORT" \
  --model-id "$MODEL_ID" \
  --ctx "$CTX" \
  --ram "$RAM" \
  --kv-slots "$KV_SLOTS" \
  $EXTRA
