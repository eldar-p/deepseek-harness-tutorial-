---
name: privacy-tor
description: Maximum confidentiality: all research, APIs, downloads, and .onion via Tor. Use whenever the user wants privacy, no leaks, or "всё через тор".
---

# Privacy — everything through Tor

Host Windows must not talk to the internet for research. Path:

1. VM `whoami` Snowflake Tor → SOCKS `10.0.2.15:9050`
2. NAT `127.0.0.1:9050` on the host
3. MCP `tor-net` (`tor_check`, `tor_get`, `tor_api`, `tor_search`, `archive_*`)

Disabled on purpose: DuckDuckGo MCP, fetch MCP, Context7, clearnet `download`. Built-in browser is a leak — don't use it for these tasks.

SSH to the VM (`127.0.0.1:2222`) stays on NAT, not over Tor (that's host→guest).

## Leaks to avoid

- `socks5` (IP-only) instead of `socks5h` — already handled in MCP
- Pasting the user's real name, Windows paths, or LAN IPs into remote sites
- Logging into personal Google/GitHub/bank over Tor
- `npx` / `pip` / `apt` on the **host** (those are clearnet). Guest `apt` is OK; for guest installs prefer already-on-disk or `torsocks apt-get` after Tor is up

If `tor_check` fails: `vbox_exec` `bash /mnt/hostshare/tor-up.sh` then wait until TOR_READY.
