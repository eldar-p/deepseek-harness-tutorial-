/**
 * Host-side tools for GIM Agent / Debug modes.
 * Workspace paths are jailed under the stack workspace.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { paths } from './paths.js'
import { detectContainerEngine, engineEnv } from './detect.js'
import { isGuestRunning } from './guest.js'
import { classifyBashRisk, classifyWriteRisk } from './permission-risk.js'
import { hasMcpServers } from './mcp-client.js'
import { scheduleIndexTouch } from './code-index/touch.js'
import { searchDeferredTools, selectDeferredTool, formatToolSearchHits } from './tool-search.js'
import { isMcpSubscriptionTool } from './mcp-subscriptions.js'

const MAX_READ = Number(process.env.GIM_TOOL_MAX_READ || 8_192)
const MAX_LIST = Number(process.env.GIM_TOOL_MAX_LIST || 400)
const MAX_BASH_OUT = Number(process.env.GIM_TOOL_MAX_BASH || 32_000)

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and directories in the workspace (relative path).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path under workspace (default ".")' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write UTF-8 text to a workspace file (creates parents).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guest_bash',
      description:
        'Run a bash command inside the Docker guest at /workspace. Prefer this for builds/tests. Denied commands are blocked.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Simple substring search across workspace text files (max 40 hits).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          path: { type: 'string', description: 'Subdirectory to search (default ".")' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Ask the human clarifying questions (poll / survey) before continuing. Use when requirements are ambiguous. Wait for answers — do not invent them.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short panel title' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                prompt: { type: 'string' },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional choices; omit for free-text only',
                },
                allowMultiple: { type: 'boolean', description: 'Multi-select options' },
                allowFreeText: { type: 'boolean', description: 'Extra free-text field (default true if no options)' },
                required: { type: 'boolean' },
              },
              required: ['id', 'prompt'],
            },
          },
        },
        required: ['questions'],
      },
    },
  },
]

export const DEFERRED_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'tool_search',
      description: 'Search GIM deferred tool catalog by keywords before guessing CLI/MCP capabilities.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tool_select',
      description: 'Load full deferred tool detail by id (after tool_search).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
]

export const LSP_AGENT_TOOL = {
  type: 'function',
  function: {
    name: 'lsp_query',
    description:
      'Language-server query: hover|definition|references|symbols|workspace_symbols (host tsserver/pyright). Prefer over grep for precise nav.',
    parameters: {
      type: 'object',
      properties: {
        op: {
          type: 'string',
          description: 'hover|definition|references|symbols|workspace_symbols',
        },
        path: { type: 'string', description: 'Relative file path (optional for workspace_symbols)' },
        query: { type: 'string', description: 'Symbol query for workspace_symbols' },
        line: { type: 'number' },
        character: { type: 'number' },
      },
      required: ['op'],
    },
  },
}

export const CODE_SEARCH_AGENT_TOOL = {
  type: 'function',
  function: {
    name: 'code_search',
    description: 'Semantic search over workspace code index (uses sidecar HTTP when stack running).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
}

export const INDEX_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'code_index_status',
      description: 'Code index backend, chunk count, builtAt (local or sidecar HTTP).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'code_index_build',
      description: 'Rebuild/incremental code index (may take minutes on large repos).',
      parameters: { type: 'object', properties: {} },
    },
  },
]

export const LSP_SERVERS_AGENT_TOOL = {
  type: 'function',
  function: {
    name: 'lsp_servers',
    description: 'List host language servers available on PATH (tsserver, pyright, etc.).',
    parameters: { type: 'object', properties: {} },
  },
}

export const MCP_SUBSCRIPTION_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'mcp_subscribe',
      description: 'Subscribe to an MCP resource URI for change polling (use mcp_poll_subscriptions).',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string' },
          uri: { type: 'string' },
        },
        required: ['server', 'uri'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcp_poll_subscriptions',
      description: 'Poll subscribed MCP resources for changes since last check.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

export function deferredToolsEnabled() {
  return process.env.GIM_DEFERRED_TOOLS !== '0'
}

export const MCP_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'mcp_list_tools',
      description:
        'List tools/resources/prompts from external MCP servers (~/.gim/mcp-servers.json). kind: tools|resources|prompts|all.',
      parameters: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            description: 'tools (default), resources, prompts, or all',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcp_call',
      description:
        'Call MCP tool, read resource (type=resource, uri=...), or get prompt (type=prompt, prompt=...).',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Server name from mcp-servers.json' },
          type: { type: 'string', description: 'tool (default), resource, or prompt' },
          tool: { type: 'string', description: 'Tool name when type=tool' },
          uri: { type: 'string', description: 'Resource URI when type=resource' },
          prompt: { type: 'string', description: 'Prompt name when type=prompt' },
          arguments: { type: 'object', description: 'Tool or prompt arguments' },
        },
        required: ['server'],
      },
    },
  },
]

export function modesWithTools(mode) {
  return mode === 'agent' || mode === 'debug' || mode === 'ask' || mode === 'plan'
}

/** Full toolset vs clarify-only for Ask/Plan. */
export function toolsForMode(mode, stack = 'default') {
  if (mode === 'agent' || mode === 'debug') {
    /** @type {object[]} */
    let base
    if (deferredToolsEnabled()) {
      base = [
        ...DEFERRED_AGENT_TOOLS,
        ...AGENT_TOOLS.filter((t) => t.function?.name !== 'search_files'),
        LSP_AGENT_TOOL,
        LSP_SERVERS_AGENT_TOOL,
        CODE_SEARCH_AGENT_TOOL,
        ...INDEX_AGENT_TOOLS,
      ]
    } else {
      base = [...AGENT_TOOLS]
    }
    if (hasMcpServers() || process.env.GIM_MCP_TOOLS === '1') {
      base.push(...MCP_AGENT_TOOLS, ...MCP_SUBSCRIPTION_TOOLS)
    }
    return base
  }
  if (mode === 'ask' || mode === 'plan') {
    return AGENT_TOOLS.filter((t) => t.function?.name === 'ask_user')
  }
  return []
}

function workspaceRoot(stack) {
  return path.resolve(paths(stack).workspace)
}

/** Resolve relative path inside workspace; null if escape. */
export function resolveWorkspacePath(stack, rel = '.') {
  const root = workspaceRoot(stack)
  const cleaned = String(rel || '.').replace(/\\/g, '/').replace(/^\/+/, '')
  const full = path.resolve(root, cleaned === '' ? '.' : cleaned)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
  if (full !== root && !full.startsWith(rootWithSep)) return null
  return full
}

export function listWorkspaceDir(stack, rel = '.') {
  const full = resolveWorkspacePath(stack, rel)
  if (!full) return { ok: false, error: 'path escapes workspace' }
  if (!fs.existsSync(full)) return { ok: false, error: 'not found' }
  if (!fs.statSync(full).isDirectory()) return { ok: false, error: 'not a directory' }
  const ents = fs.readdirSync(full, { withFileTypes: true }).slice(0, MAX_LIST)
  return {
    ok: true,
    path: String(rel || '.').replace(/\\/g, '/') || '.',
    entries: ents.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : e.isSymbolicLink() ? 'link' : 'file',
    })),
  }
}

export function readWorkspaceFile(stack, rel) {
  const full = resolveWorkspacePath(stack, rel)
  if (!full) return { ok: false, error: 'path escapes workspace' }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return { ok: false, error: 'not a file' }
  const buf = fs.readFileSync(full)
  if (buf.length > MAX_READ) {
    return {
      ok: true,
      path: rel,
      truncated: true,
      content: buf.subarray(0, MAX_READ).toString('utf8'),
      bytes: buf.length,
    }
  }
  return { ok: true, path: rel, content: buf.toString('utf8'), bytes: buf.length }
}

export function writeWorkspaceFile(stack, rel, content) {
  const risk = classifyWriteRisk(rel)
  if (risk.level === 'deny') return { ok: false, error: `write denied: ${risk.reason}` }
  const full = resolveWorkspacePath(stack, rel)
  if (!full) return { ok: false, error: 'path escapes workspace' }
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, String(content ?? ''), 'utf8')
  scheduleIndexTouch(stack, rel)
  return { ok: true, path: rel, bytes: Buffer.byteLength(String(content ?? ''), 'utf8') }
}

export function searchWorkspace(stack, query, rel = '.') {
  const root = resolveWorkspacePath(stack, rel)
  if (!root) return { ok: false, error: 'path escapes workspace' }
  const q = String(query || '')
  if (!q) return { ok: false, error: 'empty query' }
  const hits = []
  const skip = new Set(['node_modules', '.git', 'dist', '.coverage', '.gim'])

  function walk(dir, depth) {
    if (hits.length >= 40 || depth > 8) return
    let ents
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      if (skip.has(e.name)) continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (e.isFile()) {
        try {
          const st = fs.statSync(p)
          if (st.size > 200_000) continue
          const text = fs.readFileSync(p, 'utf8')
          const idx = text.indexOf(q)
          if (idx === -1) continue
          const line = text.slice(0, idx).split(/\r?\n/).length
          hits.push({
            path: path.relative(workspaceRoot(stack), p).replace(/\\/g, '/'),
            line,
            snippet: text.slice(Math.max(0, idx - 40), idx + q.length + 40).replace(/\s+/g, ' '),
          })
        } catch {
          /* binary / unreadable */
        }
      }
      if (hits.length >= 40) return
    }
  }
  walk(root, 0)
  return { ok: true, query: q, hits }
}

export function guestBash(stack, command) {
  const cmd = String(command || '').trim()
  if (!cmd) return { ok: false, error: 'empty command' }
  const risk = classifyBashRisk(cmd)
  if (risk.level === 'deny') {
    return { ok: false, error: `denied: ${risk.reason}`, risk }
  }
  if (!isGuestRunning(stack)) {
    return { ok: false, error: 'guest not running — start stack with Docker guest', risk }
  }
  const engine = detectContainerEngine()
  if (!engine.ok || !engine.bin) return { ok: false, error: 'no container engine', risk }
  const name = `gim-guest-${stack}`
  const r = spawnSync(engine.bin, ['exec', '-i', '-w', '/workspace', name, 'bash', '-lc', cmd], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: MAX_BASH_OUT,
    env: engineEnv(engine.bin),
    timeout: 120_000,
  })
  const stdout = String(r.stdout || '').slice(0, MAX_BASH_OUT)
  const stderr = String(r.stderr || '').slice(0, 20_000)
  return {
    ok: r.status === 0,
    exitCode: r.status,
    stdout,
    stderr,
    risk,
  }
}

/**
 * @param {string} stack
 * @param {string} name
 * @param {object} args
 */
export function runAgentTool(stack, name, args = {}) {
  switch (name) {
    case 'list_dir':
      return listWorkspaceDir(stack, args.path || '.')
    case 'read_file':
      return readWorkspaceFile(stack, args.path)
    case 'write_file':
      return writeWorkspaceFile(stack, args.path, args.content)
    case 'guest_bash':
      return guestBash(stack, args.command)
    case 'search_files':
      return searchWorkspace(stack, args.query, args.path || '.')
    case 'ask_user':
      return { ok: true, pending: true, questions: args.questions || [], title: args.title || 'Clarification' }
    case 'tool_search': {
      const hits = searchDeferredTools(args.query || '', { limit: args.limit ?? 6 })
      return { ok: true, hits: formatToolSearchHits(hits) }
    }
    case 'tool_select': {
      const t = selectDeferredTool(args.id || '')
      return t ? { ok: true, tool: t } : { ok: false, error: `unknown tool id ${args.id}` }
    }
    default:
      return { ok: false, error: `unknown tool: ${name}` }
  }
}

/**
 * Async agent tools (LSP, MCP subscriptions).
 */
export async function runAgentToolAsync(stack, name, args = {}) {
  if (isMcpAgentTool(name)) {
    return runMcpAgentTool(name, args)
  }
  if (name === 'code_search') {
    const { searchIndex, defaultIndexDir } = await import('./code-index/indexer.js')
    const { readRunState } = await import('./runstate.js')
    const ws = workspaceRoot(stack)
    const run = readRunState(stack)
    const r = await searchIndex({
      workspaceRoot: ws,
      indexDir: defaultIndexDir(ws),
      query: String(args.query || ''),
      limit: Number(args.limit) || 8,
      llamaBase: run?.urls?.llama,
      stack,
    })
    return r
  }
  if (name === 'code_index_status') {
    const { indexStatus, defaultIndexDir, indexStatusViaHttp } = await import('./code-index/indexer.js')
    const http = await indexStatusViaHttp(stack)
    if (http) return { ok: true, ...http, source: 'sidecar' }
    const ws = workspaceRoot(stack)
    return { ok: true, ...indexStatus(defaultIndexDir(ws)), source: 'local' }
  }
  if (name === 'code_index_build') {
    const { buildIndexViaHttp, buildIndex, defaultIndexDir } = await import('./code-index/indexer.js')
    const { readRunState } = await import('./runstate.js')
    const http = await buildIndexViaHttp(stack)
    if (http.ok) return { ...http, source: 'sidecar' }
    const ws = workspaceRoot(stack)
    const run = readRunState(stack)
    return {
      ...(await buildIndex({
        workspaceRoot: ws,
        indexDir: defaultIndexDir(ws),
        llamaBase: run?.urls?.llama,
      })),
      source: 'local',
    }
  }
  if (name === 'lsp_servers') {
    const { listAvailableServers } = await import('./lsp-bridge.js')
    return { ok: true, servers: listAvailableServers() }
  }
  if (name === 'lsp_query') {
    const { lspQuery } = await import('./lsp-bridge.js')
    const op = args.op || 'hover'
    const isWs = op === 'workspace_symbols' || op === 'workspaceSymbol'
    const rel = String(args.path || '')
    const full = rel ? resolveWorkspacePath(stack, rel) : null
    if (rel && !full) return { ok: false, error: 'path escapes workspace' }
    if (!isWs && !full) return { ok: false, error: 'path required for this op' }
    return lspQuery({
      op,
      file: full || undefined,
      query: args.query || '',
      line: Number(args.line || 0),
      character: Number(args.character || args.col || 0),
      workspace: workspaceRoot(stack),
    })
  }
  return runAgentTool(stack, name, args)
}

/** @param {string} name @param {object} args */
export function isMcpAgentTool(name) {
  return name === 'mcp_list_tools' || name === 'mcp_call'
}

export function isAsyncAgentTool(name) {
  return (
    isMcpAgentTool(name) ||
    isMcpSubscriptionTool(name) ||
    name === 'lsp_query' ||
    name === 'lsp_servers' ||
    name === 'code_search' ||
    name === 'code_index_status' ||
    name === 'code_index_build'
  )
}

export const TOOLS_TEXT_FALLBACK = `
Native tool_calls are unavailable on this endpoint. To run a GIM tool, emit exactly one block then stop:

\`\`\`gim-tool
{"name":"list_dir","args":{"path":"."}}
\`\`\`

Tools: tool_search, tool_select, list_dir, read_file, write_file, guest_bash, ask_user, code_search, code_index_status, lsp_query, lsp_servers, mcp_list_tools, mcp_call, mcp_subscribe.
Prefer code_search / lsp_query over blind grep. For ask_user use args: {"title":"…","questions":[{"id":"q1","prompt":"…","options":["A","B"]}]}.
`.trim()

export const AGENT_SYSTEM_EXTRA = `
You have tools: tool_search/tool_select, list_dir, read_file, write_file, guest_bash, ask_user, lsp_query (incl. workspace_symbols), lsp_servers, code_search, code_index_status/build, mcp_* when configured.
Prefer code_search and lsp_query over exploratory grep. Build index once if code_search is empty (code_index_build).
guest_bash runs in the Docker guest (/workspace). MCP: mcp_list_tools → mcp_call; mcp_subscribe (auto-poll debounced).
When you need the user to choose, call ask_user. Answer directly after tools. Follow .gim/ai-instructions.md when present.
`.trim()

export const ASK_PLAN_SYSTEM_EXTRA = `
If requirements are ambiguous, call ask_user (options + free text). Do not invent preferences.
Never paste a numbered menu without ask_user — the user cannot click plain text.
`.trim()
