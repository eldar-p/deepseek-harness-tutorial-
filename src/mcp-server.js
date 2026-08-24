/**
 * Deep MCP protocol handlers (stdio JSON-RPC) — testable without readline.
 */
import { indexStatus, defaultIndexDir } from './code-index/indexer.js'
import { paths } from './paths.js'
import { classifyBashRisk } from './permission-risk.js'
import { summarizeStacks } from './runstate.js'
import { searchDeferredTools, selectDeferredTool, formatToolSearchHits } from './tool-search.js'
import { daemonTick } from './daemon.js'

export const MCP_PROTOCOL = '2024-11-05'
export const MCP_SERVER_INFO = { name: 'deep-cli', version: '1.1.0' }

export const MCP_TOOLS = [
  {
    name: 'tool_search',
    description:
      'Search deferred Deep tool catalog by keywords (ToolSearch pattern). Prefer this before guessing tools.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords, +id, or select:id' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'tool_select',
    description: 'Load full deferred tool detail by id (after tool_search).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
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
  {
    name: 'stack_status',
    description: 'List Deep stacks and active llama/DSH/guest flags.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'risk_classify',
    description: 'Heuristic bash risk: allow|confirm|deny.',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
  },
  {
    name: 'daemon_tick',
    description: 'One health probe of llama/DSH for a stack.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Stack name (default)' } },
    },
  },
]

/**
 * @param {string} name
 * @param {object} args
 * @param {{ indexUrl?: string, fetchFn?: typeof fetch }} [opts]
 */
export async function callMcpTool(name, args = {}, opts = {}) {
  const INDEX_URL = opts.indexUrl || process.env.DEEP_INDEX_URL || 'http://127.0.0.1:14150'
  const fetchFn = opts.fetchFn || globalThis.fetch

  if (name === 'tool_search') {
    const hits = searchDeferredTools(args.query || '', { limit: args.limit ?? 6 })
    return { content: [{ type: 'text', text: formatToolSearchHits(hits) }] }
  }
  if (name === 'tool_select') {
    const t = selectDeferredTool(args.id || '')
    if (!t) return { content: [{ type: 'text', text: `unknown tool id ${args.id}` }], isError: true }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(t, null, 2),
        },
      ],
    }
  }
  if (name === 'code_index_status') {
    const s = indexStatus(defaultIndexDir(paths().workspace))
    return { content: [{ type: 'text', text: JSON.stringify(s, null, 2) }] }
  }
  if (name === 'code_index_build') {
    const r = await fetchFn(`${INDEX_URL.replace(/\/$/, '')}/build`, { method: 'POST' })
    const j = await r.json()
    return { content: [{ type: 'text', text: JSON.stringify(j, null, 2) }] }
  }
  if (name === 'code_search') {
    const r = await fetchFn(`${INDEX_URL.replace(/\/$/, '')}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: args.query || '', limit: args.limit ?? 8 }),
    })
    const j = await r.json()
    if (!j.ok) {
      return { content: [{ type: 'text', text: j.error || 'index empty' }], isError: true }
    }
    const lines = (j.hits || []).map(
      (h) => `${h.path}:${h.startLine}-${h.endLine} ${h.kind} ${h.symbol} score=${h.score}\n${h.preview}`,
    )
    return { content: [{ type: 'text', text: lines.join('\n---\n') || 'no hits' }] }
  }
  if (name === 'stack_status') {
    return { content: [{ type: 'text', text: JSON.stringify(summarizeStacks(), null, 2) }] }
  }
  if (name === 'risk_classify') {
    const v = classifyBashRisk(args.command || '')
    return { content: [{ type: 'text', text: JSON.stringify(v) }] }
  }
  if (name === 'daemon_tick') {
    const summary = await daemonTick(args.name || 'default', { fetchFn })
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
  }
  return { content: [{ type: 'text', text: `unknown tool ${name}` }], isError: true }
}

/**
 * @param {object} req
 * @param {{ reply: (msg: object) => void, indexUrl?: string, fetchFn?: typeof fetch }} ctx
 */
export async function handleMcpRequest(req, ctx) {
  const { id, method, params } = req
  const respond = (result) => id != null && ctx.reply({ jsonrpc: '2.0', id, result })
  const err = (code, message) =>
    id != null && ctx.reply({ jsonrpc: '2.0', id, error: { code, message } })

  try {
    if (method === 'initialize') {
      return respond({
        protocolVersion: MCP_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: MCP_SERVER_INFO,
      })
    }
    if (method === 'notifications/initialized') return
    if (method === 'tools/list') {
      return respond({ tools: MCP_TOOLS })
    }
    if (method === 'tools/call') {
      const out = await callMcpTool(params?.name, params?.arguments || {}, ctx)
      return respond(out)
    }
    if (method === 'ping') return respond({})
    err(-32601, `Method not found: ${method}`)
  } catch (e) {
    err(-32603, String(e.message || e))
  }
}
