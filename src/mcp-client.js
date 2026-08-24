/**
 * MCP client — connect to external stdio MCP servers from GIM config.
 * Hand-rolled JSON-RPC (zero npm deps).
 */
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { loadMcpServersConfig, mcpServersConfigPath } from './mcp-config.js'

export const MCP_CLIENT_PROTOCOL = '2024-11-05'
const DEFAULT_TIMEOUT_MS = 30_000

/** @typedef {{ command: string, args?: string[], env?: Record<string, string>, disabled?: boolean }} McpServerSpec */

/**
 * @param {string} [configPath]
 * @returns {Record<string, McpServerSpec>}
 */
export function loadEnabledMcpServers(configPath) {
  const cfg = loadMcpServersConfig(configPath)
  /** @type {Record<string, McpServerSpec>} */
  const out = {}
  for (const [name, spec] of Object.entries(cfg.mcpServers || {})) {
    if (!spec || spec.disabled) continue
    if (!spec.command) continue
    out[name] = spec
  }
  return out
}

export function hasMcpServers(configPath) {
  return Object.keys(loadEnabledMcpServers(configPath)).length > 0
}

/**
 * Minimal stdio MCP session (one request at a time).
 */
export class McpStdioClient {
  /**
   * @param {McpServerSpec & { name?: string }} spec
   * @param {{ timeoutMs?: number }} [opts]
   */
  constructor(spec, opts = {}) {
    this.spec = spec
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    /** @type {import('node:child_process').ChildProcessWithoutNullStreams | null} */
    this.proc = null
    this.nextId = 1
    /** @type {Map<number, { resolve: Function, reject: Function, timer: NodeJS.Timeout }>} */
    this.pending = new Map()
    this.buffer = ''
    this.ready = false
    /** @type {((msg: object) => void) | null} */
    this.onNotification = null
  }

  async connect() {
    if (this.ready) return
    const env = { ...process.env, ...(this.spec.env || {}) }
    this.proc = spawn(this.spec.command, this.spec.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      windowsHide: true,
    })
    this.proc.stdout.on('data', (chunk) => this._onData(chunk))
    this.proc.stderr.on('data', () => {})
    this.proc.on('error', (e) => this._failAll(e))
    this.proc.on('exit', (code) => {
      if (!this.ready) this._failAll(new Error(`MCP server exited before ready (code ${code})`))
    })

    await this.request('initialize', {
      protocolVersion: MCP_CLIENT_PROTOCOL,
      capabilities: {},
      clientInfo: { name: 'gim-cli', version: '1.1.2' },
    })
    await this.notify('notifications/initialized', {})
    this.ready = true
  }

  /** @param {Buffer|string} chunk */
  _onData(chunk) {
    this.buffer += chunk.toString('utf8')
    for (;;) {
      const nl = this.buffer.indexOf('\n')
      if (nl === -1) break
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        clearTimeout(p.timer)
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        else p.resolve(msg.result)
        continue
      }
      if (msg.method && msg.id == null && this.onNotification) {
        this.onNotification(msg)
      }
    }
  }

  /** @param {Error} e */
  _failAll(e) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(e)
    }
    this.pending.clear()
  }

  /**
   * @param {string} method
   * @param {object} [params]
   */
  request(method, params = {}) {
    if (!this.proc?.stdin) return Promise.reject(new Error('MCP process not started'))
    const id = this.nextId++
    const payload = { jsonrpc: '2.0', id, method, params }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP timeout: ${method}`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.proc.stdin.write(`${JSON.stringify(payload)}\n`)
    })
  }

  /**
   * @param {string} method
   * @param {object} [params]
   */
  async notify(method, params = {}) {
    if (!this.proc?.stdin) throw new Error('MCP process not started')
    const payload = { jsonrpc: '2.0', method, params }
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`)
  }

  async listTools() {
    await this.connect()
    const r = await this.request('tools/list', {})
    return r?.tools || []
  }

  async listResources() {
    await this.connect()
    const r = await this.request('resources/list', {})
    return r?.resources || []
  }

  /**
   * @param {string} uri
   */
  async readResource(uri) {
    await this.connect()
    return this.request('resources/read', { uri })
  }

  async listPrompts() {
    await this.connect()
    const r = await this.request('prompts/list', {})
    return r?.prompts || []
  }

  /**
   * @param {string} name
   * @param {object} [args]
   */
  async getPrompt(name, args = {}) {
    await this.connect()
    return this.request('prompts/get', { name, arguments: args })
  }

  /**
   * @param {string} uri
   */
  async subscribeResource(uri) {
    await this.connect()
    return this.request('resources/subscribe', { uri })
  }

  /**
   * @param {string} uri
   */
  async unsubscribeResource(uri) {
    await this.connect()
    return this.request('resources/unsubscribe', { uri })
  }

  /**
   * @param {string} name
   * @param {object} args
   */
  async callTool(name, args = {}) {
    await this.connect()
    return this.request('tools/call', { name, arguments: args })
  }

  close() {
    this.ready = false
    try {
      this.proc?.kill()
    } catch {
      /* ignore */
    }
    this.proc = null
    this._failAll(new Error('MCP client closed'))
  }
}

/** @type {Map<string, McpStdioClient>} */
const sessionCache = new Map()

/**
 * @param {string} serverName
 * @param {string} [configPath]
 */
export function getMcpClient(serverName, configPath) {
  const servers = loadEnabledMcpServers(configPath)
  const spec = servers[serverName]
  if (!spec) throw new Error(`unknown MCP server: ${serverName}`)
  const key = `${configPath || mcpServersConfigPath()}::${serverName}`
  if (!sessionCache.has(key)) {
    sessionCache.set(key, new McpStdioClient({ ...spec, name: serverName }))
  }
  return sessionCache.get(key)
}

export function closeAllMcpClients() {
  for (const c of sessionCache.values()) c.close()
  sessionCache.clear()
}

/**
 * @param {string} [configPath]
 */
export async function listAllMcpTools(configPath) {
  const servers = loadEnabledMcpServers(configPath)
  /** @type {{ server: string, tools: object[], error?: string }[]} */
  const out = []
  for (const name of Object.keys(servers)) {
    try {
      const client = getMcpClient(name, configPath)
      const tools = await client.listTools()
      out.push({ server: name, tools })
    } catch (e) {
      out.push({ server: name, tools: [], error: String(e.message || e) })
    }
  }
  return out
}

/**
 * @param {string} [configPath]
 */
export async function listAllMcpResources(configPath) {
  const servers = loadEnabledMcpServers(configPath)
  /** @type {{ server: string, resources: object[], error?: string }[]} */
  const out = []
  for (const name of Object.keys(servers)) {
    try {
      const client = getMcpClient(name, configPath)
      const resources = await client.listResources()
      out.push({ server: name, resources })
    } catch (e) {
      out.push({ server: name, resources: [], error: String(e.message || e) })
    }
  }
  return out
}

/**
 * @param {string} [configPath]
 */
export async function listAllMcpPrompts(configPath) {
  const servers = loadEnabledMcpServers(configPath)
  /** @type {{ server: string, prompts: object[], error?: string }[]} */
  const out = []
  for (const name of Object.keys(servers)) {
    try {
      const client = getMcpClient(name, configPath)
      const prompts = await client.listPrompts()
      out.push({ server: name, prompts })
    } catch (e) {
      out.push({ server: name, prompts: [], error: String(e.message || e) })
    }
  }
  return out
}

/**
 * @param {string} serverName
 * @param {string} uri
 * @param {string} [configPath]
 */
export async function readMcpServerResource(serverName, uri, configPath) {
  const client = getMcpClient(serverName, configPath)
  const result = await client.readResource(uri)
  return normalizeMcpResourceResult(result)
}

/**
 * @param {string} serverName
 * @param {string} promptName
 * @param {object} [args]
 * @param {string} [configPath]
 */
export async function getMcpServerPrompt(serverName, promptName, args = {}, configPath) {
  const client = getMcpClient(serverName, configPath)
  const result = await client.getPrompt(promptName, args)
  return normalizeMcpPromptResult(result)
}

/**
 * Subscribe to resource updates; resolves on first notification or timeout.
 * @param {string} serverName
 * @param {string} uri
 * @param {{ timeoutMs?: number, configPath?: string }} [opts]
 */
export async function watchMcpResource(serverName, uri, opts = {}) {
  const servers = loadEnabledMcpServers(opts.configPath)
  const spec = servers[serverName]
  if (!spec) throw new Error(`unknown MCP server: ${serverName}`)
  const client = new McpStdioClient(spec, { timeoutMs: opts.timeoutMs ?? 60_000 })
  const timeoutMs = opts.timeoutMs ?? 60_000
  try {
    await client.connect()
    await client.subscribeResource(uri)
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        client.onNotification = null
        resolve({ ok: true, subscribed: true, uri, timeout: true, notifications: [] })
      }, timeoutMs)
      /** @type {object[]} */
      const notes = []
      client.onNotification = (msg) => {
        if (msg.method === 'notifications/resources/updated') {
          notes.push(msg.params || {})
          clearTimeout(timer)
          client.onNotification = null
          resolve({ ok: true, subscribed: true, uri, notifications: notes })
        }
      }
    })
  } finally {
    try {
      await client.unsubscribeResource(uri)
    } catch {
      /* */
    }
    client.close()
  }
}

/**
 * @param {string} serverName
 * @param {string} toolName
 * @param {object} args
 * @param {string} [configPath]
 */
export async function callMcpServerTool(serverName, toolName, args = {}, configPath) {
  const client = getMcpClient(serverName, configPath)
  const result = await client.callTool(toolName, args)
  return normalizeMcpToolResult(result)
}

/**
 * @param {object} result
 */
export function normalizeMcpToolResult(result) {
  if (!result) return { ok: true, text: '' }
  if (result.isError) {
    const text = (result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
    return { ok: false, error: text || 'MCP tool error', raw: result }
  }
  const text = (result.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
  return { ok: true, text, raw: result }
}

/**
 * @param {object} result
 */
export function normalizeMcpResourceResult(result) {
  if (!result?.contents?.length) return { ok: true, text: '', raw: result }
  const text = result.contents
    .map((c) => {
      if (c.text) return c.text
      if (c.blob) return `[blob ${c.mimeType || 'application/octet-stream'}]`
      return ''
    })
    .filter(Boolean)
    .join('\n')
  return { ok: true, text, raw: result }
}

/**
 * @param {object} result
 */
export function normalizeMcpPromptResult(result) {
  const messages = result?.messages || []
  const text = messages
    .map((m) => {
      const body =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p) => p.text || '').join('')
            : JSON.stringify(m.content ?? '')
      return `${m.role || 'user'}: ${body}`
    })
    .join('\n')
  return { ok: true, text, raw: result }
}

/**
 * @param {string} [configPath]
 */
export async function doctorMcpServers(configPath) {
  const servers = loadEnabledMcpServers(configPath)
  /** @type {{ name: string, ok: boolean, toolCount?: number, resourceCount?: number, promptCount?: number, detail: string }[]} */
  const rows = []
  for (const name of Object.keys(servers)) {
    try {
      const client = new McpStdioClient(servers[name], { timeoutMs: 15_000 })
      const tools = await client.listTools()
      let resourceCount = 0
      let promptCount = 0
      try {
        resourceCount = (await client.listResources()).length
      } catch {
        /* optional capability */
      }
      try {
        promptCount = (await client.listPrompts()).length
      } catch {
        /* optional capability */
      }
      client.close()
      const parts = [`${tools.length} tools`]
      if (resourceCount) parts.push(`${resourceCount} resources`)
      if (promptCount) parts.push(`${promptCount} prompts`)
      rows.push({ name, ok: true, toolCount: tools.length, resourceCount, promptCount, detail: parts.join(', ') })
    } catch (e) {
      rows.push({ name, ok: false, detail: String(e.message || e) })
    }
  }
  return rows
}

/**
 * Agent tool handler for mcp_list_tools / mcp_call.
 * @param {string} toolName
 * @param {object} args
 */
export async function runMcpAgentTool(toolName, args = {}) {
  if (toolName === 'mcp_list_tools') {
    if (!hasMcpServers()) {
      return { ok: false, error: 'no MCP servers — add via: gim mcp client add NAME' }
    }
    const kind = String(args.kind || 'tools').toLowerCase()
    /** @type {string[]} */
    const lines = []
    if (kind === 'tools' || kind === 'all') {
      const rows = await listAllMcpTools()
      for (const r of rows) {
        if (r.error) lines.push(`[${r.server}] tools ERROR: ${r.error}`)
        else lines.push(...r.tools.map((t) => `[${r.server}] tool ${t.name}: ${t.description || ''}`.trim()))
      }
    }
    if (kind === 'resources' || kind === 'all') {
      const rows = await listAllMcpResources()
      for (const r of rows) {
        if (r.error) lines.push(`[${r.server}] resources ERROR: ${r.error}`)
        else
          lines.push(
            ...r.resources.map(
              (res) => `[${r.server}] resource ${res.uri}: ${res.name || ''} ${res.description || ''}`.trim(),
            ),
          )
      }
    }
    if (kind === 'prompts' || kind === 'all') {
      const rows = await listAllMcpPrompts()
      for (const r of rows) {
        if (r.error) lines.push(`[${r.server}] prompts ERROR: ${r.error}`)
        else
          lines.push(
            ...r.prompts.map(
              (p) => `[${r.server}] prompt ${p.name}: ${p.description || ''}`.trim(),
            ),
          )
      }
    }
    if (!lines.length && !['tools', 'resources', 'prompts', 'all'].includes(kind)) {
      return { ok: false, error: 'kind must be tools, resources, prompts, or all' }
    }
    return { ok: true, kind, listing: lines.join('\n') || '(empty)' }
  }
  if (toolName === 'mcp_call') {
    const server = String(args.server || '').trim()
    const type = String(args.type || 'tool').toLowerCase()
    if (!server) {
      return { ok: false, error: 'mcp_call requires server' }
    }
    try {
      if (type === 'resource') {
        const uri = String(args.uri || args.resource || '').trim()
        if (!uri) return { ok: false, error: 'mcp_call type=resource requires uri' }
        const r = await readMcpServerResource(server, uri)
        return r.ok
          ? { ok: true, type, result: r.text, server, uri }
          : { ok: false, error: r.error || 'resource read failed', server, uri }
      }
      if (type === 'prompt') {
        const prompt = String(args.prompt || args.name || args.tool || '').trim()
        if (!prompt) return { ok: false, error: 'mcp_call type=prompt requires prompt' }
        const r = await getMcpServerPrompt(server, prompt, args.arguments || args.args || {})
        return { ok: true, type, result: r.text, server, prompt }
      }
      const name = String(args.tool || args.name || '').trim()
      if (!name) {
        return { ok: false, error: 'mcp_call requires tool (or type=resource|prompt)' }
      }
      const r = await callMcpServerTool(server, name, args.arguments || args.args || {})
      return r.ok ? { ok: true, type: 'tool', result: r.text, server, tool: name } : { ok: false, error: r.error, server, tool: name }
    } catch (e) {
      return { ok: false, error: String(e.message || e), server, type }
    }
  }
  return { ok: false, error: `unknown MCP agent tool: ${toolName}` }
}
