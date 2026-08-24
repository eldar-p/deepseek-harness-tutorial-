import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPreset, defaultConfig, applyPreset, registerStack, PRESET_NAMES } from '../src/config.js'

test('PRESET_NAMES includes balanced', () => {
  assert.ok(PRESET_NAMES.includes('balanced'))
})

test('loadPreset balanced', () => {
  const p = loadPreset('balanced')
  assert.equal(p.guestNetwork, 'allowlist')
  assert.equal(p.zeroTraces, 'soft')
})

test('loadPreset unknown throws exitCode 2', () => {
  assert.throws(() => loadPreset('nope'), (e) => e.exitCode === 2)
})

test('defaultConfig merges preset', () => {
  const c = defaultConfig({ preset: 'offline' })
  assert.equal(c.preset, 'offline')
  assert.equal(c.guestNetwork, 'none')
})

test('registerStack records stack metadata', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-cfg-'))
  const prev = process.env.GIM_HOME
  process.env.GIM_HOME = home
  try {
    const cfg = defaultConfig()
    const out = registerStack(cfg, 'dev', { preset: 'dev', device: 'cpu' })
    assert.equal(out.defaultStack, 'dev')
    assert.equal(out.stacks.dev.preset, 'dev')
    assert.ok(out.stacks.dev.updatedAt)
    assert.ok(fs.existsSync(path.join(home, 'config.json')))
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
