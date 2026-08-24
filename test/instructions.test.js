import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  scanProjectSignals,
  initAiInstructions,
  refreshAiInstructions,
  syncAiInstructions,
  loadAiInstructionsBlock,
  aiInstructionsPath,
} from '../src/instructions.js'
import { cmdInstructions } from '../src/instructions-cli.js'

test('scanProjectSignals reads package.json scripts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-instr-'))
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'demo-app',
      description: 'Demo project',
      scripts: { test: 'node --test', lint: 'eslint .', build: 'tsc' },
    }),
  )
  const s = scanProjectSignals(root)
  assert.equal(s.name, 'demo-app')
  assert.equal(s.pm, 'npm')
  assert.ok(s.scripts.some((x) => x.name === 'test'))
  fs.rmSync(root, { recursive: true, force: true })
})

test('init refresh sync instructions in workspace', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-instr-ws-'))
  process.env.GIM_HOME = home
  const stack = 'utest-inst'
  const ws = path.join(home, 'workspace', stack)
  fs.mkdirSync(ws, { recursive: true })
  fs.writeFileSync(
    path.join(ws, 'package.json'),
    JSON.stringify({ name: 'ws-demo', scripts: { test: 'npm test' } }),
  )
  try {
    const init = initAiInstructions(stack)
    assert.equal(init.created, true)
    assert.ok(fs.existsSync(aiInstructionsPath(stack)))

    const refreshed = refreshAiInstructions(stack)
    assert.ok(refreshed.scriptCount >= 1)
    const text = fs.readFileSync(refreshed.path, 'utf8')
    assert.match(text, /ws-demo/)
    assert.match(text, /npm run test/)

    const synced = syncAiInstructions(stack, { writeAgents: true })
    assert.ok(fs.existsSync(synced.agentsPath))
    assert.match(fs.readFileSync(synced.agentsPath, 'utf8'), /ai-instructions/)

    const block = loadAiInstructionsBlock(stack)
    assert.match(block, /Project instructions/)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('cmdInstructions init show', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-instr-cli-'))
  process.env.GIM_HOME = home
  const stack = 'cli-inst'
  fs.mkdirSync(path.join(home, 'workspace', stack), { recursive: true })
  try {
    await cmdInstructions({ name: stack }, ['init'])
    await cmdInstructions({ name: stack }, ['show'])
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
