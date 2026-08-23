#!/bin/bash
# Lean install for small rootfs (~4G). Heavy stuff on /mnt/hostshare.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export ALL_PROXY=socks5h://127.0.0.1:9050
export HTTPS_PROXY=socks5h://127.0.0.1:9050
export HTTP_PROXY=socks5h://127.0.0.1:9050

sudo -n true
echo "kodachi ALL=(ALL) NOPASSWD:ALL" | sudo -n tee /etc/sudoers.d/kodachi-nopasswd >/dev/null
sudo -n chmod 440 /etc/sudoers.d/kodachi-nopasswd

# apt cache on hostshare
sudo -n mkdir -p /mnt/hostshare/apt-cache/archives/partial
echo 'Dir::Cache::Archives "/mnt/hostshare/apt-cache/archives";' | sudo -n tee /etc/apt/apt.conf.d/00hostshare-cache >/dev/null

sudo -n apt-get update -qq

# Essential small packages only
ESSENTIAL=(
  zsh tmux screen fzf ripgrep fd-find jq curl wget gawk
  build-essential make cmake pkg-config
  python3 python3-pip python3-venv python3-dev
  python3-bs4 python3-requests python3-lxml
  pylint bandit shellcheck
  perl ruby
  nodejs npm
  lua5.4
  sqlite3 postgresql-client redis-tools default-mysql-client
  iproute2 iptables tcpdump net-tools dnsutils nmap traceroute
  wireguard-tools openvpn stunnel4 openssl
  strace gdb lsof rsync git
  w3m lynx yq
  moreutils parallel tree unzip zip p7zip-full file htop
)

OK=()
for p in "${ESSENTIAL[@]}"; do
  apt-cache show "$p" >/dev/null 2>&1 && OK+=("$p") || echo "skip $p"
done

sudo -n apt-get install -y "${OK[@]}" 2>&1 | tee /mnt/hostshare/agent-install-lean.log | tail -40

# Optional medium (only if >1.2G free)
FREE_K=$(df -k / | awk 'NR==2{print $4}')
if [[ "$FREE_K" -gt 1200000 ]]; then
  OPT=(golang-go shadowsocks-libev clang cppcheck)
  OO=()
  for p in "${OPT[@]}"; do apt-cache show "$p" >/dev/null 2>&1 && OO+=("$p") || true; done
  [[ ${#OO[@]} -gt 0 ]] && sudo -n apt-get install -y "${OO[@]}" 2>&1 | tail -20 || true
else
  echo "skip optional: low disk"
fi

# NEVER install docker.io on 4G root — document podman static / rootless later
echo "NOTE: docker/podman/k8s/sonarqube -> install under /mnt/hostshare when disk allows"

# pip tools into venv on hostshare (not root)
python3 -m venv /mnt/hostshare/agent/venv
# shellcheck disable=SC1091
source /mnt/hostshare/agent/venv/bin/activate
pip install -U pip wheel 2>&1 | tail -5 || true
pip install --proxy socks5h://127.0.0.1:9050 \
  bandit pylint ruff httpx aiohttp structlog rich typer sqlmap 2>&1 | tail -25 || \
  pip install bandit pylint ruff httpx structlog rich typer 2>&1 | tail -25 || true

# npm eslint with cache on hostshare
mkdir -p /mnt/hostshare/npm-cache
npm config set cache /mnt/hostshare/npm-cache
npm config set proxy socks5h://127.0.0.1:9050 || true
npm config set https-proxy socks5h://127.0.0.1:9050 || true
npm install -g eslint 2>&1 | tail -15 || true

# agent layout
BASE=/mnt/hostshare/agent
mkdir -p "$BASE"/{logs,checkpoints,queue,knowledge,reports,cache,tmp,bin,state,metrics,repos}
chmod +x "$BASE/bin/agent-ops.sh" 2>/dev/null || true
grep -q 'hostshare/agent/venv' "$HOME/.bashrc" 2>/dev/null || \
  echo 'export PATH="/mnt/hostshare/agent/venv/bin:/mnt/hostshare/agent/bin:$HOME/bin:$PATH"' >> "$HOME/.bashrc"

# sqlmap via apt if small
apt-cache show sqlmap >/dev/null 2>&1 && sudo -n apt-get install -y sqlmap 2>&1 | tail -5 || true

echo "== versions =="
for b in bash python3 perl ruby node npm go gcc make cmake tmux zsh rg fzf jq yq \
         curl wget bandit pylint eslint sqlmap redis-cli psql sqlite3 \
         wg openvpn stunnel openssl tcpdump git strace; do
  if command -v "$b" >/dev/null 2>&1; then printf "OK  %-10s %s\n" "$b" "$(command -v $b)"; else printf "NO  %s\n" "$b"; fi
done
df -h / /mnt/hostshare | sed -n '1,3p'
echo LEAN_INSTALL_DONE
