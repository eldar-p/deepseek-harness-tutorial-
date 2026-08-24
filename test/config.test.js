import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPreset, defaultConfig, applyPreset, PRESET_NAMES } from '../src/config.js'

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
