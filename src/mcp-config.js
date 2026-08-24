/**
 * MCP configuration — IDE snippets + GIM external server registry.
 */
import fs from 'node:fs'
import path from 'node:path'
import { gimHome, PKG_ROOT } from './paths.js'

/**
 * @returns {string}
 */
export function mcpServersConfigPath() {
  return path.join(gimHome(), 'mcp-servers.json')
}

/**
 * @returns {{ mcpServers: Record<string, { command: string, args?: string[], env?: Record<string, string>, disabled?: boolean }> }}
 */
export function loadMcpServersConfig(configPath = mcpServersConfigPath()) {
  if (!fs.existsSync(configPath)) {
    return { mcpServers: {} }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    return { mcpServers: raw.mcpServers || raw || {} }
  } catch {
    return { mcpServers: {} }
  }
}

/**
 * @param {{ mcpServers: Record<string, object> }} cfg
 * @param {string} [configPath]
 */
export function saveMcpServersConfig(cfg, configPath = mcpServersConfigPath()) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: cfg.mcpServers || {} }, null, 2), 'utf8')
}

/**
 * @param {{ gimBin?: string, indexUrl?: string }} [opts]
 */
export function buildMcpClientConfig(opts = {}) {
  const gimBin = opts.gimBin || path.join(PKG_ROOT, 'bin', 'gim.js')
  const indexUrl = opts.indexUrl || process.env.GIM_INDEX_URL || 'http://127.0.0.1:14150'
  return {
    mcpServers: {
      gim: {
        command: 'node',
        args: [gimBin, 'mcp'],
        env: {
          GIM_INDEX_URL: indexUrl,
        },
      },
    },
  }
}

export function formatMcpConfigHelp(opts = {}) {
  const cfg = buildMcpClientConfig(opts)
  const registry = mcpServersConfigPath()
  return [
    'Cursor / Claude Desktop — add to MCP settings:',
    '',
    JSON.stringify(cfg, null, 2),
    '',
    'GIM external MCP registry (agent mcp_call):',
    `  ${registry}`,
    '  gim mcp client list | add | doctor',
    '',
    'Or: node scripts/gim-mcp.mjs',
  ].join('\n')
}
