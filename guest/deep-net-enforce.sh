#!/bin/bash
# deep-net-enforce — guest egress policy from DEEP_NET_* (beta).
# Requires: CAP_NET_ADMIN, iptables, dig (dnsutils). Failures are non-fatal.
set -u

MODE="${DEEP_NET_MODE:-allowlist}"
ALLOW="${DEEP_NET_ALLOWLIST:-}"

log() { echo "[deep-net] $*"; }

apply_offline() {
  log "mode=offline — host should use --network none; skipping iptables"
}

apply_open() {
  log "mode=open — no egress filter (WARN)"
  iptables -P OUTPUT ACCEPT 2>/dev/null || true
}

resolve_ips() {
  local domain="$1"
  dig +short A "$domain" 2>/dev/null | grep -E '^[0-9.]+$' || true
}

apply_allowlist() {
  if [[ -z "$ALLOW" || "$ALLOW" == "*" ]]; then
    log "empty/wildcard allowlist — treating as open"
    apply_open
    return
  fi

  if ! command -v iptables >/dev/null 2>&1; then
    log "iptables missing — env policy only"
    return
  fi

  log "mode=allowlist domains=$ALLOW"
  iptables -F OUTPUT 2>/dev/null || true
  if ! iptables -P OUTPUT DROP 2>/dev/null; then
    log "WARN: cannot set OUTPUT DROP (need NET_ADMIN?) — env policy only"
    return
  fi
  iptables -A OUTPUT -o lo -j ACCEPT 2>/dev/null || true
  iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
    iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
  iptables -A OUTPUT -p udp --dport 53 -j ACCEPT 2>/dev/null || true
  iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT 2>/dev/null || true

  IFS=',' read -ra DOMAINS <<< "$ALLOW"
  for d in "${DOMAINS[@]}"; do
    d=$(echo "$d" | tr -d ' ')
    [[ -z "$d" || "$d" == "*" ]] && continue
    while read -r ip; do
      [[ -z "$ip" ]] && continue
      iptables -A OUTPUT -d "$ip" -j ACCEPT 2>/dev/null || true
      log "allow $d -> $ip"
    done < <(resolve_ips "$d")
  done
  log "OUTPUT policy=DROP + allowlist applied"
}

apply_proxy() {
  local proxy_host="${DEEP_PROXY_HOST:-host.docker.internal}"
  local proxy_port="${DEEP_PROXY_PORT:-3128}"
  log "mode=proxy via ${proxy_host}:${proxy_port}"
  apply_allowlist
  # curl/wget in guest should use HTTP_PROXY; iptables still blocks non-allowlisted IPs
}

case "$MODE" in
  none|offline) apply_offline ;;
  open) apply_open ;;
  proxy) apply_proxy ;;
  *) apply_allowlist ;;
esac

exec "$@"
