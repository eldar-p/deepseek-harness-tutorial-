---
name: web-access
description: Search and fetch only through Tor. Use for current info, pages, APIs, .onion — never host DuckDuckGo/fetch/browser.
---

# Web access (Tor only · solo model)

Clearnet search MCPs and DSH built-in Search are disabled. No separate researcher model.

1. `bash /mnt/hostshare/tor-up.sh` if needed
2. Tor curl: `curl --socks5-hostname 127.0.0.1:9050 'URL'`
3. MCP `tor-net` when available: `tor_check`, `tor_search`, `tor_get`, `tor_api`
4. Archives via Tor tools

Built-in browser / DeepSeek Search = leak. Don't use them.
