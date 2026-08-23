#!/bin/bash
set -e
export ALL_PROXY=socks5h://127.0.0.1:9050
export HTTPS_PROXY=socks5h://127.0.0.1:9050
export HTTP_PROXY=socks5h://127.0.0.1:9050
python3 -m venv "$HOME/.agent-venv"
# shellcheck disable=SC1091
source "$HOME/.agent-venv/bin/activate"
pip install -q --upgrade pip
pip install -q PySocks requests beautifulsoup4 lxml html2text
python - <<'PY'
import requests, bs4
print("venv_ok", requests.__version__)
PY
mkdir -p "$HOME/bin"
cat > "$HOME/bin/torenv" <<'EOF'
#!/bin/bash
export ALL_PROXY=socks5h://127.0.0.1:9050
export HTTPS_PROXY=socks5h://127.0.0.1:9050
export HTTP_PROXY=socks5h://127.0.0.1:9050
exec "$@"
EOF
chmod +x "$HOME/bin/torenv"
grep -q '.agent-venv' "$HOME/.bashrc" 2>/dev/null || echo 'export PATH="$HOME/bin:$HOME/.agent-venv/bin:$PATH"' >> "$HOME/.bashrc"
sudo -n apt-file update 2>&1 | tail -8 || echo "apt-file update skipped"
echo SETUP_DONE
