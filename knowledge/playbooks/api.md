---
name: api
description: Call HTTP/JSON APIs through Tor (GET/POST/PUT). Use when the user mentions API, REST, webhook, Bearer token, GraphQL, or JSON endpoints — clearnet or .onion.
---

# APIs through Tor

All API calls go through MCP `tor-net` (`tor_api`, `tor_get`). Never the host `fetch` / DuckDuckGo MCPs (they leak clearnet). Never onion-lab.

## tor_api

- `url` — full `https://` or `http://…onion`
- `method` — GET POST PUT PATCH DELETE
- `header` — one `Name: value` per line (Authorization, Accept, …)
- `body` — raw JSON for POST/PUT/PATCH

Example:

```
url: https://httpbin.org/post
method: POST
header: Accept: application/json
body: {"ok": true}
```

## Rules

- Read status/`http_code` from the tool output before claiming success.
- Do not print API keys in chat; pass them only in `header`.
- `.onion` APIs: same tool, hostname must stay a hostname (`socks5h` is already on).
- No credential stuffing, no token theft, no scanning random APIs.
