import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMcpClientConfig, formatMcpConfigHelp } from '../src/mcp-config.js'

test('buildMcpClientConfig has gim server', () => {
  const cfg = buildMcpClientConfig({ gimBin: '/tmp/gim.js', indexUrl: 'http://127.0.0.1:9' })
  assert.equal(cfg.mcpServers.gim.command, 'node')
  assert.deepEqual(cfg.mcpServers.gim.args, ['/tmp/gim.js', 'mcp'])
  assert.equal(cfg.mcpServers.gim.env.GIM_INDEX_URL, 'http://127.0.0.1:9')
})

test('formatMcpConfigHelp includes json', () => {
  assert.match(formatMcpConfigHelp({ gimBin: 'x.js' }), /mcpServers/)
  assert.match(formatMcpConfigHelp({ gimBin: 'x.js' }), /mcp-servers.json/)
})
