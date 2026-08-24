#!/usr/bin/env node
/**
 * Deep MCP server (stdio) — exposes Deep tools to Cursor/DSH/Claude Desktop.
 *
 * Usage:
 *   deep mcp
 *   node scripts/deep-mcp.mjs
 *
 * MCP config example:
 *   "deep": { "command": "node", "args": ["PATH/to/bin/deep.js", "mcp"] }
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
