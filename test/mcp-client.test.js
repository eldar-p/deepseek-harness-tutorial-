import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  loadMcpServersConfig,
  saveMcpServersConfig,
  mcpServersConfigPath,
} from '../src/mcp-config.js'
import {
  loadEnabledMcpServers,
  normalizeMcpToolResult,
  hasMcpServers,
} from '../src/mcp-client.js'

test('mcp servers config save load', () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mcp-cfg-'))
  process.env.GIM_HOME = home
  try {
    saveMcpServersConfig({
      mcpServers: {
        demo: { command: 'node', args: ['demo.mjs'], env: { X: '1' } },
      },
    })
    const cfg = loadMcpServersConfig()
    assert.equal(cfg.mcpServers.demo.command, 'node')
    assert.deepEqual(cfg.mcpServers.demo.args, ['demo.mjs'])
    assert.equal(mcpServersConfigPath().endsWith('mcp-servers.json'), true)
    assert.equal(hasMcpServers(), true)
    const enabled = loadEnabledMcpServers()
    assert.ok(enabled.demo)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('normalizeMcpToolResult text and error', () => {
  const ok = normalizeMcpToolResult({
    content: [{ type: 'text', text: 'hello' }],
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.text, 'hello')
  const err = normalizeMcpToolResult({
    isError: true,
    content: [{ type: 'text', text: 'fail' }],
  })
  assert.equal(err.ok, false)
  assert.match(err.error, /fail/)
})

test('normalizeMcpResourceResult and prompt', async () => {
  const { normalizeMcpResourceResult, normalizeMcpPromptResult, runMcpAgentTool } = await import('../src/mcp-client.js')
  const res = normalizeMcpResourceResult({
    contents: [{ text: 'file body' }, { blob: 'abc', mimeType: 'image/png' }],
  })
  assert.match(res.text, /file body/)
  assert.match(res.text, /blob/)
  const prompt = normalizeMcpPromptResult({
    messages: [{ role: 'user', content: 'hello' }],
  })
  assert.match(prompt.text, /user: hello/)
  const bad = await runMcpAgentTool('mcp_call', { server: 'x', type: 'resource' })
  assert.equal(bad.ok, false)
  assert.match(bad.error, /uri/)
})

test('disabled MCP servers excluded', () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mcp-off-'))
  process.env.GIM_HOME = home
  try {
    saveMcpServersConfig({
      mcpServers: {
        on: { command: 'node', args: ['a.mjs'] },
        off: { command: 'node', args: ['b.mjs'], disabled: true },
      },
    })
    const enabled = loadEnabledMcpServers()
    assert.ok(enabled.on)
    assert.equal(enabled.off, undefined)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
