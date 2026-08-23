#!/bin/bash
# Grow /dev/sda1 to full VDI and use it for apt/tmp/opt (off live tmpfs overlay).
set -euo pipefail
PERSIST=/mnt/persist
DEV=/dev/sda1

[[ -b /dev/sda ]] || { echo "NO /dev/sda"; exit 1; }

# Grow partition to end of disk (after VDI resize)
sudo -n growpart /dev/sda 1 2>/dev/null || {
  # fallback: parted resize if growpart missing
  if command -v parted >/dev/null; then
    sudo -n parted -s /dev/sda resizepart 1 100% 2>/dev/null || true
  fi
}
sudo -n partprobe /dev/sda 2>/dev/null || true

# Ensure filesystem + label
if ! sudo -n blkid "$DEV" >/dev/null 2>&1; then
  sudo -n mkfs.ext4 -F -L persistence "$DEV"
fi
sudo -n e2label "$DEV" persistence 2>/dev/null || true

sudo -n mkdir -p "$PERSIST"
if ! mountpoint -q "$PERSIST"; then
  sudo -n mount "$DEV" "$PERSIST"
fi
sudo -n resize2fs "$DEV" 2>/dev/null || true

# live-boot persistence marker (used on next boot with 'persistence' cmdline)
echo '/ overlay' | sudo -n tee "$PERSIST/persistence.conf" >/dev/null

# dirs for heavy data
sudo -n mkdir -p \
  "$PERSIST/var/cache/apt/archives/partial" \
  "$PERSIST/var/lib/apt/lists/partial" \
  "$PERSIST/tmp" \
  "$PERSIST/opt" \
  "$PERSIST/usr/local" \
  "$PERSIST/home/kodachi/.agent-venv" \
  "$PERSIST/agent"/{venv,cache,logs,npm-cache} \
  "$PERSIST/swap"

sudo -n chmod 1777 "$PERSIST/tmp"
sudo -n chown -R kodachi:kodachi "$PERSIST/home/kodachi" "$PERSIST/agent" 2>/dev/null || true

# apt writes to disk, not tmpfs overlay
sudo -n tee /etc/apt/apt.conf.d/01persist-disk >/dev/null <<EOF
Dir::Cache "$PERSIST/var/cache/apt";
Dir::Cache::Archives "$PERSIST/var/cache/apt/archives";
Dir::State "$PERSIST/var/lib/apt";
EOF

# TMPDIR for dpkg unpack / builds
grep -q 'TMPDIR=/mnt/persist/tmp' /etc/environment 2>/dev/null || \
  echo 'TMPDIR=/mnt/persist/tmp' | sudo -n tee -a /etc/environment >/dev/null
export TMPDIR="$PERSIST/tmp"

# bind opt + usr/local onto disk (packages that install there)
seed_bind() {
  local src="$1" dst="$2"
  sudo -n mkdir -p "$src" "$dst"
  if mountpoint -q "$dst"; then
    echo "already bound $dst"
    return 0
  fi
  if [[ -n "$(ls -A "$dst" 2>/dev/null || true)" ]] && [[ -z "$(ls -A "$src" 2>/dev/null || true)" ]]; then
    sudo -n rsync -a "$dst/" "$src/" 2>/dev/null || true
  fi
  sudo -n mount --bind "$src" "$dst"
  echo "bound $src -> $dst"
}

seed_bind "$PERSIST/opt" /opt
seed_bind "$PERSIST/usr/local" /usr/local

# agent venv on disk
if [[ -d /home/kodachi/.agent-venv ]] && ! mountpoint -q /home/kodachi/.agent-venv; then
  if [[ ! -d "$PERSIST/home/kodachi/.agent-venv/bin" ]] && [[ -d /home/kodachi/.agent-venv/bin ]]; then
    sudo -n rsync -a /home/kodachi/.agent-venv/ "$PERSIST/home/kodachi/.agent-venv/" 2>/dev/null || true
  fi
  sudo -n mkdir -p /home/kodachi/.agent-venv
  sudo -n mount --bind "$PERSIST/home/kodachi/.agent-venv" /home/kodachi/.agent-venv
  sudo -n chown -R kodachi:kodachi /home/kodachi/.agent-venv
fi

# 4G swap on disk
SWAP="$PERSIST/swap/swapfile"
if [[ ! -f "$SWAP" ]] || [[ $(stat -c%s "$SWAP" 2>/dev/null || echo 0) -lt 4000000000 ]]; then
  sudo -n rm -f "$SWAP"
  sudo -n fallocate -l 4G "$SWAP" || sudo -n dd if=/dev/zero of="$SWAP" bs=1M count=4096 status=none
  sudo -n chmod 600 "$SWAP"
  sudo -n mkswap "$SWAP"
fi
sudo -n swapon "$SWAP" 2>/dev/null || true

# fstab for remount after reboot (live still needs setup script)
grep -q 'LABEL=persistence' /etc/fstab 2>/dev/null || \
  echo 'LABEL=persistence /mnt/persist ext4 defaults,nofail 0 2' | sudo -n tee -a /etc/fstab >/dev/null
grep -q "$SWAP" /etc/fstab 2>/dev/null || \
  echo "$SWAP none swap sw,nofail 0 0" | sudo -n tee -a /etc/fstab >/dev/null

# install boot helper onto persist + hostshare copy
sudo -n install -m 755 /mnt/hostshare/setup-persist-disk.sh /usr/local/sbin/setup-persist-disk.sh 2>/dev/null || true
sudo -n mkdir -p /etc/systemd/system
if [[ ! -f /etc/systemd/system/persist-disk.service ]]; then
  sudo -n tee /etc/systemd/system/persist-disk.service >/dev/null <<'UNIT'
[Unit]
Description=Mount persist disk and bind heavy paths
After=local-fs.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/setup-persist-disk.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT
  sudo -n systemctl daemon-reload
  sudo -n systemctl enable persist-disk.service 2>/dev/null || true
fi

# free a bit of overlay: apt lists/archives already redirected
sudo -n rm -rf /var/cache/apt/archives/*.deb 2>/dev/null || true

df -h / "$PERSIST" /opt /usr/local 2>/dev/null || df -h /
free -h
echo PERSIST_DISK_OK
