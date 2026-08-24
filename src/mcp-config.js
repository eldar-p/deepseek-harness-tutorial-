/**
 * MCP client config snippets (Cursor / Claude Desktop).
 */
import path from 'node:path'
import { PKG_ROOT } from './paths.js'

/**
 * @param {{ gimBin?: string, indexUrl?: string }} [opts]
 */
export function buildMcpClientConfig(opts = {}) {
  const gimBin = opts.gimBin || path.join(PKG_ROOT, 'bin', 'gim.js')
  const indexUrl = opts.indexUrl || process.env.GIM_INDEX_URL || 'http://127.0.0.1:14150'
  return {
    mcpServers: { gim: {
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
  return [
    'Cursor / Claude Desktop — add to MCP settings:',
    '',
    JSON.stringify(cfg, null, 2),
    '',
    'Or: node scripts/gim-mcp.mjs',
  ].join('\n')
}
