#!/bin/bash
set -euo pipefail
exec > >(tee /mnt/hostshare/tor-up.log) 2>&1
CONF=/mnt/hostshare/ai/torrc.client

# Binary is enough; skip apt after reboot if already installed (dpkg may be broken).
if ! command -v snowflake-client >/dev/null && [ ! -x /usr/bin/snowflake-client ]; then
  if ! sudo DEBIAN_FRONTEND=noninteractive apt-get install -y snowflake-client; then
    echo "snowflake-client missing and apt install failed; abort"
    exit 1
  fi
fi
if [ ! -f "$CONF" ]; then
  echo "missing $CONF"
  exit 1
fi

sudo mkdir -p /var/lib/tor /var/log/tor
sudo chown -R debian-tor:debian-tor /var/lib/tor /var/log/tor
sudo cp "$CONF" /etc/tor/torrc.cline
sudo chmod 644 /etc/tor/torrc.cline

if pgrep -x tor >/dev/null; then
  sudo killall tor || true
  sleep 1
fi

sudo -u debian-tor /usr/bin/tor -f /etc/tor/torrc.cline --PidFile /var/lib/tor/tor.pid
echo "waiting for snowflake bootstrap..."
for i in $(seq 1 90); do
  if curl -fsS --max-time 12 --socks5-hostname 127.0.0.1:9050 \
      https://check.torproject.org/api/ip >/tmp/tor-ip.json 2>/dev/null; then
    cat /tmp/tor-ip.json
    echo
    echo TOR_READY
    exit 0
  fi
  sleep 2
done
echo "not ready"
sudo tail -n 50 /var/log/tor/notices.log || true
exit 2
