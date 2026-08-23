#!/bin/bash
# Install agent full stack inside whoami via Tor. Idempotent.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export ALL_PROXY=socks5h://127.0.0.1:9050
export HTTPS_PROXY=socks5h://127.0.0.1:9050
export HTTP_PROXY=socks5h://127.0.0.1:9050

echo "== sudo =="
sudo -n true

echo "== apt update =="
sudo -n apt-get update -qq

PKGS=(
  # shells / multiplexers / core CLI
  zsh tmux screen fzf ripgrep fd-find jq curl wget ca-certificates gnupg
  moreutils parallel tree unzip zip p7zip-full file less htop procps psmisc
  # text pipeline
  gawk sed coreutils findutils grep
  # languages / build
  build-essential gcc g++ clang make cmake pkg-config autoconf automake libtool
  python3 python3-pip python3-venv python3-dev python3-bs4 python3-requests python3-lxml
  perl ruby ruby-dev golang-go
  nodejs npm
  lua5.4 luarocks
  # SQL / DB clients
  sqlite3 postgresql-client redis-tools mongodb-clients default-mysql-client
  # lint / security scanners (code)
  pylint bandit shellcheck cppcheck clang-tidy
  # net / vpn / crypto (ops)
  iproute2 iptables nftables tcpdump net-tools traceroute dnsutils nmap
  wireguard-tools openvpn stunnel4 openssl
  shadowsocks-libev
  # containers (if available)
  docker.io podman buildah
  # debug / admin
  strace gdb lsof inotify-tools rsync git git-lfs
  # docs / http
  w3m lynx manpages manpages-dev
  # yaml
  yq
)

echo "== installing packages =="
# install what exists; skip missing
OK=()
MISS=()
for p in "${PKGS[@]}"; do
  if apt-cache show "$p" >/dev/null 2>&1; then
    OK+=("$p")
  else
    MISS+=("$p")
  fi
done
echo "MISSING: ${MISS[*]:-none}"
sudo -n apt-get install -y "${OK[@]}" 2>&1 | tail -30

# Node eslint globally (via tor)
if command -v npm >/dev/null; then
  echo "== npm eslint =="
  npm config set proxy socks5h://127.0.0.1:9050 || true
  npm config set https-proxy socks5h://127.0.0.1:9050 || true
  sudo -n npm install -g eslint 2>&1 | tail -15 || true
fi

# Python security/lint extras in user venv
echo "== python venv tools =="
python3 -m venv "$HOME/.agent-venv" || true
# shellcheck disable=SC1091
source "$HOME/.agent-venv/bin/activate"
pip install --upgrade pip 2>&1 | tail -3 || true
pip install --proxy socks5h://127.0.0.1:9050 \
  bandit pylint ruff semgrep httpx aiohttp structlog rich typer \
  redis celery 2>&1 | tail -20 || \
pip install bandit pylint ruff httpx aiohttp structlog rich typer 2>&1 | tail -20 || true

# sqlmap from apt or pip
if apt-cache show sqlmap >/dev/null 2>&1; then
  sudo -n apt-get install -y sqlmap 2>&1 | tail -5
else
  pip install --proxy socks5h://127.0.0.1:9050 sqlmap 2>&1 | tail -10 || true
fi

# agent home layout
BASE=/mnt/hostshare/agent
mkdir -p "$BASE"/{logs,checkpoints,queue,knowledge,reports,cache,tmp,bin,state,metrics}
mkdir -p "$HOME/bin"
grep -q '.agent-venv' "$HOME/.bashrc" 2>/dev/null || \
  echo 'export PATH="$HOME/bin:$HOME/.agent-venv/bin:$PATH"' >> "$HOME/.bashrc"

# passwordless sudo confirm
echo "kodachi ALL=(ALL) NOPASSWD:ALL" | sudo -n tee /etc/sudoers.d/kodachi-nopasswd >/dev/null
sudo -n chmod 440 /etc/sudoers.d/kodachi-nopasswd

echo "== versions =="
for b in bash python3 perl ruby go node npm rustc cargo java gcc g++ make cmake \
         tmux screen zsh rg fzf jq yq curl wget docker podman kubectl \
         sqlmap bandit pylint eslint redis-cli mongosh psql \
         wg openvpn stunnel openssl tcpdump iptables; do
  if command -v "$b" >/dev/null 2>&1; then
    printf "%-12s %s\n" "$b" "$(command -v "$b")"
  else
    printf "%-12s MISSING\n" "$b"
  fi
done

echo INSTALL_DONE
