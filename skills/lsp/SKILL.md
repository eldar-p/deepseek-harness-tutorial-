# LSP bridge

Use host Language Servers for precise code navigation (definition, references, hover, symbols).

## Tools

- `lsp_servers` — which servers are installed on the host PATH
- `lsp_query` — `{ op, path, line?, character? }`

## Install servers (host)

```bash
npm i -g typescript-language-server typescript   # JS/TS
npm i -g pyright                                 # Python (pyright-langserver)
```

If a server is missing, GIM returns a clear error — fall back to `gim index search` / read.

## Notes

- Paths are workspace-relative (same as `/workspace/...` in guest).
- LSP runs on the **host**, not inside the guest container.
