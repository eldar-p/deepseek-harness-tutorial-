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
    const base = [...AGENT_TOOLS]
    if (hasMcpServers() || process.env.GIM_MCP_TOOLS === '1') {
      base.push(...MCP_AGENT_TOOLS)
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
    default:
      return { ok: false, error: `unknown tool: ${name}` }
  }
}

/** @param {string} name @param {object} args */
export function isMcpAgentTool(name) {
  return name === 'mcp_list_tools' || name === 'mcp_call'
}

export const TOOLS_TEXT_FALLBACK = `
Native tool_calls are unavailable on this endpoint. To run a GIM tool, emit exactly one block then stop:

\`\`\`gim-tool
{"name":"list_dir","args":{"path":"."}}
\`\`\`

Tools: list_dir, read_file, write_file, search_files, guest_bash, ask_user, mcp_list_tools, mcp_call (same names/args as always).
For ask_user use args: {"title":"…","questions":[{"id":"q1","prompt":"…","options":["A","B"]}]}.
`.trim()

export const AGENT_SYSTEM_EXTRA = `
You have tools: list_dir, read_file, write_file, search_files, guest_bash, ask_user, mcp_list_tools, mcp_call.
Use tools to inspect the workspace before guessing. guest_bash runs in the Docker guest (/workspace).
External integrations: mcp_list_tools (kind=tools|resources|prompts|all) then mcp_call (type=tool|resource|prompt).
When you need the user to choose or clarify, call ask_user (1–4 short questions with options when possible).
After tools, answer the user's latest request directly. Do not repeat the same menu.
Follow .gim/ai-instructions.md when present.
`.trim()

export const ASK_PLAN_SYSTEM_EXTRA = `
If requirements are ambiguous, call ask_user (options + free text). Do not invent preferences.
Never paste a numbered menu without ask_user — the user cannot click plain text.
`.trim()
