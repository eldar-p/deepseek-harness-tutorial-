import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMcpClientConfig, formatMcpConfigHelp } from '../src/mcp-config.js'

test('buildMcpClientConfig has deep server', () => {
  const cfg = buildMcpClientConfig({ deepBin: '/tmp/deep.js', indexUrl: 'http://127.0.0.1:9' })
  assert.equal(cfg.mcpServers.deep.command, 'node')
  assert.deepEqual(cfg.mcpServers.deep.args, ['/tmp/deep.js', 'mcp'])
  assert.equal(cfg.mcpServers.deep.env.DEEP_INDEX_URL, 'http://127.0.0.1:9')
})

test('formatMcpConfigHelp includes json', () => {
  assert.match(formatMcpConfigHelp({ deepBin: 'x.js' }), /mcpServers/)
})
