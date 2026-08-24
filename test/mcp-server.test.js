import test from 'node:test'
import assert from 'node:assert/strict'
import { callMcpTool, handleMcpRequest, MCP_TOOLS } from '../src/mcp-server.js'

test('MCP_TOOLS includes tool_search', () => {
  assert.ok(MCP_TOOLS.some((t) => t.name === 'tool_search'))
})

test('callMcpTool tool_search', async () => {
  const out = await callMcpTool('tool_search', { query: 'egress secrets' })
  assert.match(out.content[0].text, /egress_proxy/)
})

test('callMcpTool risk_classify', async () => {
  const out = await callMcpTool('risk_classify', { command: 'rm -rf /' })
  assert.match(out.content[0].text, /deny/)
})

test('handleMcpRequest tools/list', async () => {
  const replies = []
  await handleMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { reply: (m) => replies.push(m) },
  )
  assert.equal(replies[0].id, 1)
  assert.ok(replies[0].result.tools.length >= 5)
})

test('handleMcpRequest initialize', async () => {
  const replies = []
  await handleMcpRequest(
    { jsonrpc: '2.0', id: 2, method: 'initialize', params: {} },
    { reply: (m) => replies.push(m) },
  )
  assert.equal(replies[0].result.serverInfo.name, 'deep-cli')
})
