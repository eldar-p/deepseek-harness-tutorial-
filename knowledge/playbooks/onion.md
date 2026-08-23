---
name: onion
description: Fetch user-specified .onion or deep-web URLs through Tor. Use for onion, hidden service, deep web page the user named. Do not invent or list markets.
---

# .onion / deep web (Tor only)

Deep web here means pages and APIs that are not in Google, including **.onion the user actually gave**. MCP `tor_get` / `tor_api` / `tor_search`.

## How

1. `tor_check` — `"IsTor":true`
2. `tor_get` with the full URL (`http://….onion/…` or https clearnet via Tor)
3. For JSON APIs, `tor_api`

Search: `tor_search` (DuckDuckGo HTML via Tor). It does **not** crawl a hidden-service index.

## Official examples only if needed

- Tor Project check: `https://check.torproject.org/api/ip`
- Tor Project onion (v3): `http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/`

## Don't

- Don't invent marketplace / forum onion addresses.
- Don't browse for stolen data, card shops, ransomware leaks, CSAM.
- Don't use the Cursor/Cline built-in browser (that's the host, not Tor).
- Don't SSH 10.10.40.61 / onion-lab.
