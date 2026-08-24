import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cmdMcp } from '../src/mcp-cli.js'

test('cmdMcp client add list remove', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mcp-cli-'))
  process.env.GIM_HOME = home
  try {
    await cmdMcp({ command: 'node', args: '["x.mjs"]' }, ['client', 'add', 'demo'])
    await cmdMcp({}, ['client', 'list'])
    await cmdMcp({}, ['client', 'remove', 'demo'])
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('cmdMcp config prints snippet', async () => {
  await cmdMcp({}, ['config'])
})
