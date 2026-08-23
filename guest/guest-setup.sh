#!/bin/bash
set -x
id
command -v sshd || true
command -v ssh || true
dpkg -l openssh-server 2>/dev/null | tail -1 || true
sudo -n true && echo SUDO_OK || echo SUDO_FAIL
ip -4 addr || true
ip link || true
install -d -m 700 /home/kodachi/.ssh
# Put your host pubkey here (or: SSH_PUBKEY='ssh-ed25519 AAAA…' ./guest-setup.sh)
if [ -n "${SSH_PUBKEY:-}" ]; then
  echo "$SSH_PUBKEY" >> /home/kodachi/.ssh/authorized_keys
elif [ -f /mnt/hostshare/ssh/id_ed25519.pub ]; then
  cat /mnt/hostshare/ssh/id_ed25519.pub >> /home/kodachi/.ssh/authorized_keys
else
  echo "WARN: no SSH_PUBKEY /mnt/hostshare/ssh/id_ed25519.pub — add authorized_keys manually"
fi
chmod 700 /home/kodachi/.ssh
chmod 600 /home/kodachi/.ssh/authorized_keys
sudo ssh-keygen -A || true
if command -v sshd >/dev/null; then
  sudo systemctl reset-failed ssh 2>/dev/null || true
  sudo systemctl enable --now ssh || sudo systemctl enable --now sshd || true
else
  sudo apt-get update -y || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y openssh-server || true
  sudo systemctl enable --now ssh || sudo systemctl enable --now sshd || true
fi
sudo mkdir -p /etc/ssh/sshd_config.d
echo 'PasswordAuthentication yes' | sudo tee /etc/ssh/sshd_config.d/cline.conf
echo 'PubkeyAuthentication yes' | sudo tee -a /etc/ssh/sshd_config.d/cline.conf
echo 'ListenAddress 0.0.0.0' | sudo tee -a /etc/ssh/sshd_config.d/cline.conf
sudo systemctl restart ssh || sudo systemctl restart sshd || true
sudo nft insert rule inet filter input tcp dport 22 accept 2>/dev/null || true
sudo iptables -I INPUT 1 -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
sudo ufw allow 22/tcp 2>/dev/null || true
ss -lnt | grep 22 || netstat -lnt | grep 22 || true
systemctl is-active ssh sshd || true
ip -4 addr
echo SETUP_DONE
