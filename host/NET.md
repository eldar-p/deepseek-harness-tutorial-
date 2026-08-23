# Net tools — VM whoami + Tor only

All search/fetch/API/archive/git discovery goes through MCP **tor-net** (SSH into guest, curl via Snowflake SOCKS `127.0.0.1:9050`).

Host clearnet DuckDuckGo/fetch/browser stay **disabled**.

If Tor dies: MCP `vbox-whoami` → `tor_up`, then `tor_check`.

Verified 2026-08-23: see `ai/tool-verify.json` (all OK).
