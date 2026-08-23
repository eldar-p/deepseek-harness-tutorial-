---
name: tor
description: Use Tor from the Debian VM whoami as a SOCKS client. Use when the user mentions Tor, .onion, SOCKS 9050, torsocks, anonymity, or wants traffic from the VM via Tor. Not onion-lab.
---

# Tor on VM whoami

Tor runs **only in the Debian guest**, as a local SOCKS client. Host Windows does not run Tor.

- SOCKS: `127.0.0.1:9050` **inside the guest**
- DNS for .onion: use `socks5h` (hostname resolved by Tor), never `socks5`
- Helper: `/mnt/hostshare/tor-up.sh` (Snowflake + `snowflake-client`; vanilla TLS is reset in this VM)
- Config: `/mnt/hostshare/ai/torrc.client`
- MCP: `tor_status`, `tor_fetch` on `vbox-whoami`
- Never onion-lab / `10.10.40.61`

## Before traffic

1. `tor_status` (or `vbox_exec` with `ss -lnt` and curl check).
2. If SOCKS is down: `vbox_exec` `bash /mnt/hostshare/tor-up.sh` (wait up to ~2 min for bootstrap).
3. Confirm JSON from `https://check.torproject.org/api/ip` contains `"IsTor":true`.

## Fetch through Tor

Prefer MCP `tor_fetch`. Equivalent in the guest:

```bash
curl -fsS --max-time 60 --socks5-hostname 127.0.0.1:9050 URL
# or
torsocks curl -fsS --max-time 60 URL
```

`.onion` hosts **must** use `--socks5-hostname` / `torsocks`. Direct curl will fail.

Python: `torsocks python3 script.py` if the script opens normal TCP. Or curl in a subprocess through `--socks5-hostname`.

## Isolation rules

- Do **not** torrify SSH from the Windows host to the VM (port 2222 stays NAT).
- Do **not** paste the user's real name, host paths, or Windows username into sites opened over Tor.
- Do **not** log into personal Google/GitHub/bank over Tor in this VM.
- Client snowflake is already configured here. Do **not** run a Tor relay or exit. Do **not** torrify the whole OS (`torrify-system-* --force`) unless the user asks.
- No scanning, brute force, or "check if this onion is a market". Fetch only URLs the user named or official project onions (e.g. Tor Project).

## apt over Tor

```bash
torsocks sudo apt-get update
torsocks sudo DEBIAN_FRONTEND=noninteractive apt-get install -y PKG
```

If bootstrap is stuck: `sudo tail -n 50 /var/log/tor/notices.log` then `bash /mnt/hostshare/tor-up.sh`.
