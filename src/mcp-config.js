/**
 * MCP client config snippets (Cursor / Claude Desktop).
 */
import path from 'node:path'
import { PKG_ROOT } from './paths.js'

/**
 * @param {{ deepBin?: string, indexUrl?: string }} [opts]
 */
export function buildMcpClientConfig(opts = {}) {
  const deepBin = opts.deepBin || path.join(PKG_ROOT, 'bin', 'deep.js')
  const indexUrl = opts.indexUrl || process.env.DEEP_INDEX_URL || 'http://127.0.0.1:14150'
  return {
    mcpServers: {
      deep: {
        command: 'node',
        args: [deepBin, 'mcp'],
        env: {
          DEEP_INDEX_URL: indexUrl,
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
    'Or: node scripts/deep-mcp.mjs',
  ].join('\n')
}
