import test from 'node:test'
import assert from 'node:assert/strict'
import { assessOpportunityCost, formatOpportunityCostReport } from '../src/opportunity-cost.js'
import {
  mcpPollIntervalMs,
  pollMcpSubscriptionsForAgent,
  resetMcpPollClockForTests,
  subscribeMcpResource,
} from '../src/mcp-subscriptions.js'
import { pickAnyAvailableServer } from '../src/lsp-bridge.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('assessOpportunityCost returns K and factors', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ki-'))
  process.env.GIM_HOME = home
  try {
    const r = await assessOpportunityCost('default')
    assert.ok(typeof r.K === 'number')
    assert.ok(r.K >= 0 && r.K <= 1)
    assert.ok(Array.isArray(r.factors))
    assert.ok(r.factors.some((f) => f.id === 'index_built'))
    assert.match(formatOpportunityCostReport(r), /Performance opportunity/)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('mcpPollIntervalMs default and debounce skips second poll', async () => {
  const prevHome = process.env.GIM_HOME
  const prevMs = process.env.GIM_MCP_POLL_MS
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mcp-deb-'))
  process.env.GIM_HOME = home
  process.env.GIM_MCP_POLL_MS = '60000'
  resetMcpPollClockForTests()
  try {
    assert.equal(mcpPollIntervalMs(), 60000)
    subscribeMcpResource('deb', 's', 'u://1')
    // First call runs poll (will error on unknown server — still counts as poll)
    await pollMcpSubscriptionsForAgent('deb')
    const second = await pollMcpSubscriptionsForAgent('deb')
    assert.deepEqual(second, [])
  } finally {
    resetMcpPollClockForTests()
    if (prevMs === undefined) delete process.env.GIM_MCP_POLL_MS
    else process.env.GIM_MCP_POLL_MS = prevMs
    if (prevHome === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prevHome
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('pickAnyAvailableServer shape', () => {
  const s = pickAnyAvailableServer()
  assert.ok('bin' in s)
  assert.ok('id' in s || s.id === null)
})
