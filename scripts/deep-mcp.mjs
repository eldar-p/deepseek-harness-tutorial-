#!/usr/bin/env node
/**
 * Deep MCP server (stdio) — exposes code index tools to Cursor/DSH/Claude Desktop.
 *
 * Usage in MCP config:
 *   "deep": { "command": "node", "args": ["PATH/to/scripts/deep-mcp.mjs"], "env": { "DEEP_INDEX_URL": "http://127.0.0.1:14150" } }
 *
 * Protocol: MCP JSON-RPC over stdin/stdout (one message per line).
 */
import readline from 'node:readline'
import { indexStatus, defaultIndexDir } from '../src/code-index/indexer.js'
import { paths } from '../src/paths.js'

const INDEX_URL = process.env.DEEP_INDEX_URL || 'http://127.0.0.1:14150'
const PROTOCOL = '2024-11-05'

const TOOLS = [
  {
    name: 'code_search',
    description: 'Semantic search over indexed workspace code. Run deep index build first if empty.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language or symbol name' },
        limit: { type: 'number', description: 'Max hits (default 8)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'code_index_status',
    description: 'Show code index backend, chunk count, last build time.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'code_index_build',
    description: 'Rebuild code index from workspace (may take minutes on large repos).',
    inputSchema: { type: 'object', properties: {} },
  },
]

/** @param {object} msg */
function reply(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

async function callTool(name, args) {
  if (name === 'code_index_status') {
    const s = indexStatus(defaultIndexDir(paths().workspace))
    return { content: [{ type: 'text', text: JSON.stringify(s, null, 2) }] }
  }
  if (name === 'code_index_build') {
    const r = await fetch(`${INDEX_URL.replace(/\/$/, '')}/build`, { method: 'POST' })
    const j = await r.json()
    return { content: [{ type: 'text', text: JSON.stringify(j, null, 2) }] }
  }
  if (name === 'code_search') {
    const r = await fetch(`${INDEX_URL.replace(/\/$/, '')}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: args.query || '', limit: args.limit ?? 8 }),
    })
    const j = await r.json()
    if (!j.ok) {
      return { content: [{ type: 'text', text: j.error || 'index empty' }], isError: true }
    }
    const lines = j.hits.map(
      (h) => `${h.path}:${h.startLine}-${h.endLine} ${h.kind} ${h.symbol} score=${h.score}\n${h.preview}`,
    )
    return { content: [{ type: 'text', text: lines.join('\n---\n') || 'no hits' }] }
  }
  return { content: [{ type: 'text', text: `unknown tool ${name}` }], isError: true }
}

/** @param {object} req */
async function handle(req) {
  const { id, method, params } = req
  const respond = (result) => id != null && reply({ jsonrpc: '2.0', id, result })
  const err = (code, message) =>
    id != null && reply({ jsonrpc: '2.0', id, error: { code, message } })

  try {
    if (method === 'initialize') {
      return respond({
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'deep-cli', version: '1.0.1' },
      })
    }
    if (method === 'notifications/initialized') return
    if (method === 'tools/list') {
      return respond({ tools: TOOLS })
    }
    if (method === 'tools/call') {
      const out = await callTool(params?.name, params?.arguments || {})
      return respond(out)
    }
    if (method === 'ping') return respond({})
    err(-32601, `Method not found: ${method}`)
  } catch (e) {
    err(-32603, String(e.message || e))
  }
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
  void handle(req)
})
