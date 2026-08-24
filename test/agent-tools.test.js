import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  listWorkspaceDir,
  readWorkspaceFile,
  writeWorkspaceFile,
  resolveWorkspacePath,
  runAgentTool,
  modesWithTools,
  toolsForMode,
  searchWorkspace,
} from '../src/agent-tools.js'
import { applyClarifyAnswers } from '../src/agent-loop.js'

test('modesWithTools', () => {
  assert.equal(modesWithTools('agent'), true)
  assert.equal(modesWithTools('debug'), true)
  assert.equal(modesWithTools('ask'), true)
  assert.equal(modesWithTools('plan'), true)
  assert.equal(toolsForMode('ask').length, 1)
  assert.equal(toolsForMode('ask')[0].function.name, 'ask_user')
  assert.ok(toolsForMode('agent').length > 1)
})

test('applyClarifyAnswers appends tool result', () => {
  const msgs = applyClarifyAnswers([{ role: 'assistant', content: null, tool_calls: [] }], 'tc1', {
    q1: 'yes',
  })
  assert.equal(msgs.at(-1).role, 'tool')
  assert.equal(msgs.at(-1).tool_call_id, 'tc1')
  assert.match(msgs.at(-1).content, /yes/)
})

test('workspace jail + list/read/write', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-tools-'))
  const prev = process.env.GIM_HOME
  process.env.GIM_HOME = home
  try {
    const ws = path.join(home, 'workspace', 'default')
    fs.mkdirSync(ws, { recursive: true })
    fs.writeFileSync(path.join(ws, 'a.txt'), 'hello')
    fs.mkdirSync(path.join(ws, 'sub'))

    assert.ok(resolveWorkspacePath('default', 'a.txt'))
    assert.equal(resolveWorkspacePath('default', '../x'), null)

    const listed = listWorkspaceDir('default', '.')
    assert.equal(listed.ok, true)
    assert.ok(listed.entries.some((e) => e.name === 'a.txt'))

    const read = readWorkspaceFile('default', 'a.txt')
    assert.equal(read.content, 'hello')

    const w = writeWorkspaceFile('default', 'sub/b.txt', 'world')
    assert.equal(w.ok, true)
    assert.equal(fs.readFileSync(path.join(ws, 'sub', 'b.txt'), 'utf8'), 'world')

    const search = searchWorkspace('default', 'world')
    assert.equal(search.ok, true)
    assert.ok(search.hits.some((h) => h.path.includes('b.txt')))

    const denied = runAgentTool('default', 'guest_bash', { command: 'rm -rf /' })
    assert.equal(denied.ok, false)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
