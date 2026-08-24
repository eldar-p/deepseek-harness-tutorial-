/**
 * MCP resource subscriptions — poll for agent context updates.
 * ~/.gim/mcp-subscriptions.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { paths, chmodOwnerOnly } from './paths.js'
import { readJsonFile, writeJsonFile } from './json-io.js'
import { readMcpServerResource } from './mcp-client.js'

function subsPath() {
  return path.join(paths().home, 'mcp-subscriptions.json')
}

export function loadMcpSubscriptions() {
  const f = subsPath()
  if (!fs.existsSync(f)) return { stacks: {} }
  try {
    return readJsonFile(f)
  } catch {
    return { stacks: {} }
  }
}

function saveMcpSubscriptions(cfg) {
  fs.mkdirSync(path.dirname(subsPath()), { recursive: true })
  writeJsonFile(subsPath(), cfg)
  chmodOwnerOnly(subsPath())
}

/**
 * @param {string} stack
 * @param {string} server
 * @param {string} uri
 */
export function subscribeMcpResource(stack, server, uri) {
  const cfg = loadMcpSubscriptions()
  cfg.stacks ||= {}
  cfg.stacks[stack] ||= {}
  cfg.stacks[stack][`${server}::${uri}`] = {
    server,
    uri,
    subscribedAt: new Date().toISOString(),
    lastHash: null,
    lastChecked: null,
  }
  saveMcpSubscriptions(cfg)
  return cfg.stacks[stack][`${server}::${uri}`]
}

/**
 * @param {string} stack
 * @param {string} [server]
 * @param {string} [uri]
 */
export function unsubscribeMcpResource(stack, server, uri) {
  const cfg = loadMcpSubscriptions()
  const key = `${server}::${uri}`
  if (cfg.stacks?.[stack]?.[key]) {
    delete cfg.stacks[stack][key]
    saveMcpSubscriptions(cfg)
    return true
  }
  return false
}

function contentHash(text) {
  return createHash('sha256').update(text || '').digest('hex').slice(0, 16)
}

export function countMcpSubscriptions(stack = 'default') {
  const cfg = loadMcpSubscriptions()
  return Object.keys(cfg.stacks?.[stack] || {}).length
}

export function mcpPollEnabled() {
  return process.env.GIM_MCP_POLL !== '0'
}

/** Min ms between auto-polls in agent loop (default 5s). */
export function mcpPollIntervalMs() {
  const n = Number(process.env.GIM_MCP_POLL_MS)
  return Number.isFinite(n) && n >= 0 ? n : 5000
}

/** @type {Map<string, number>} */
const lastAgentPollAt = new Map()

/** Test helper — reset debounce clock. */
export function resetMcpPollClockForTests() {
  lastAgentPollAt.clear()
}

/**
 * Format MCP resource updates for agent context injection.
 * @param {{ server: string, uri: string, preview: string }[]} updates
 */
export function formatMcpResourceUpdates(updates) {
  if (!updates.length) return ''
  const blocks = updates.map(
    (u) => `[MCP update] ${u.server} ${u.uri}\n${String(u.preview || '').slice(0, 800)}`,
  )
  return `[mcp resource updates — incorporate if relevant]\n\n${blocks.join('\n\n')}`
}

/**
 * Poll subscriptions and return only changed resources (for agent loop).
 * Debounced: skips if last poll was within GIM_MCP_POLL_MS (avoids MCP spawn every round).
 * @param {string} stack
 */
export async function pollMcpSubscriptionsForAgent(stack = 'default') {
  if (!mcpPollEnabled() || !countMcpSubscriptions(stack)) {
    return []
  }
  const now = Date.now()
  const last = lastAgentPollAt.get(stack) || 0
  const interval = mcpPollIntervalMs()
  if (interval > 0 && now - last < interval) {
    return []
  }
  lastAgentPollAt.set(stack, now)
  const r = await pollMcpSubscriptions(stack)
  return r.updates || []
}

/**
 * Poll subscribed resources; return changed since last poll.
 * @param {string} stack
 */
export async function pollMcpSubscriptions(stack = 'default') {
  const cfg = loadMcpSubscriptions()
  const entries = Object.values(cfg.stacks?.[stack] || {})
  /** @type {{ server: string, uri: string, changed: boolean, preview: string, error?: string }[]} */
  const results = []

  for (const ent of entries) {
    try {
      const r = await readMcpServerResource(ent.server, ent.uri)
      const hash = contentHash(r.text)
      const changed = ent.lastHash != null && ent.lastHash !== hash
      ent.lastHash = hash
      ent.lastChecked = new Date().toISOString()
      results.push({
        server: ent.server,
        uri: ent.uri,
        changed,
        preview: String(r.text || '').slice(0, 500),
      })
    } catch (e) {
      results.push({
        server: ent.server,
        uri: ent.uri,
        changed: false,
        preview: '',
        error: String(e.message || e),
      })
    }
  }

  saveMcpSubscriptions(cfg)
  const updates = results.filter((r) => r.changed)
  return { ok: true, stack, checked: results.length, updates, results }
}

/**
 * Agent tool handler for mcp_subscribe / mcp_poll_subscriptions.
 */
export async function runMcpSubscriptionTool(name, args = {}) {
  const stack = args.stack || 'default'
  if (name === 'mcp_subscribe') {
    const server = String(args.server || '').trim()
    const uri = String(args.uri || '').trim()
    if (!server || !uri) return { ok: false, error: 'requires server and uri' }
    subscribeMcpResource(stack, server, uri)
    return { ok: true, server, uri, subscribed: true }
  }
  if (name === 'mcp_poll_subscriptions') {
    return pollMcpSubscriptions(stack)
  }
  if (name === 'mcp_unsubscribe') {
    const ok = unsubscribeMcpResource(stack, args.server, args.uri)
    return { ok, server: args.server, uri: args.uri }
  }
  return { ok: false, error: `unknown subscription tool: ${name}` }
}

export function isMcpSubscriptionTool(name) {
  return name === 'mcp_subscribe' || name === 'mcp_poll_subscriptions' || name === 'mcp_unsubscribe'
}
