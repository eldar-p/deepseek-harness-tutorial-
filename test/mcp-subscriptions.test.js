import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  subscribeMcpResource,
  loadMcpSubscriptions,
  pollMcpSubscriptions,
  pollMcpSubscriptionsForAgent,
  formatMcpResourceUpdates,
  mcpPollEnabled,
  unsubscribeMcpResource,
  runMcpSubscriptionTool,
} from '../src/mcp-subscriptions.js'

test('mcpPollEnabled and formatMcpResourceUpdates', () => {
  const prev = process.env.GIM_MCP_POLL
  process.env.GIM_MCP_POLL = '0'
  assert.equal(mcpPollEnabled(), false)
  if (prev === undefined) delete process.env.GIM_MCP_POLL
  else process.env.GIM_MCP_POLL = prev
  const text = formatMcpResourceUpdates([{ server: 's', uri: 'u', preview: 'hello' }])
  assert.match(text, /MCP update/)
})

test('pollMcpSubscriptionsForAgent skips when no subs', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mcp-agent-'))
  process.env.GIM_HOME = home
  try {
    const r = await pollMcpSubscriptionsForAgent('empty')
    assert.deepEqual(r, [])
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('mcp subscription roundtrip', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mcp-sub-'))
  process.env.GIM_HOME = home
  try {
    subscribeMcpResource('utest', 'demo', 'file:///x')
    const cfg = loadMcpSubscriptions()
    assert.ok(cfg.stacks.utest['demo::file:///x'])
    const r = await runMcpSubscriptionTool('mcp_subscribe', {
      stack: 'utest2',
      server: 's',
      uri: 'u://1',
    })
    assert.equal(r.ok, true)
    assert.equal(unsubscribeMcpResource('utest', 'demo', 'file:///x'), true)
    const poll = await pollMcpSubscriptions('utest2')
    assert.equal(poll.ok, true)
    assert.equal(poll.stack, 'utest2')
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
