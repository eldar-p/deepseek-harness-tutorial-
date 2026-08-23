---
name: web-access
description: Search and fetch only through Tor. Use for current info, pages, APIs, .onion — never host DuckDuckGo/fetch/browser.
---

# Web access (Tor only)

Clearnet MCPs are disabled. Use:

1. `tor_check`
2. `tor_search` for discovery
3. `tor_get` / `tor_api` to read or call
4. Archives: `archive_find` / `archive_wayback` / `archive_item` / `archive_save`
5. Guest `vbox_exec` + `torsocks curl` as fallback

Built-in browser = leak. Don't use it for these tasks.
Downloads: `vbox_exec` curl through SOCKS into `/mnt/hostshare`.
