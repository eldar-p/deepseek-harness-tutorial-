#!/usr/bin/env node
/**
 * GIM MCP server (stdio) — exposes GIM tools to Cursor/DSH/Claude Desktop.
 *
 * Usage:
 *   gim mcp
 *   node scripts/gim-mcp.mjs
 *
 * MCP config example:
 *   "gim": { "command": "node", "args": ["PATH/to/bin/gim.js", "mcp"] }
 */
import readline from 'node:readline'
import { handleMcpRequest } from '../src/mcp-server.js'

function reply(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  if (!line.trim()) return
  let req
  try {
    req = JSON.parse(line)
  } catch {
    return
  }
  void handleMcpRequest(req, { reply })
})
