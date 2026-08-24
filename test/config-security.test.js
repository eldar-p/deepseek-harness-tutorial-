import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPreset, assertStackName, PRESET_NAMES } from '../src/config.js'

test('loadPreset accepts known presets', () => {
  for (const n of PRESET_NAMES) {
    const p = loadPreset(n)
    assert.ok(p && typeof p === 'object')
  }
})

test('loadPreset rejects path traversal / unknown', () => {
  assert.throws(() => loadPreset('../config'), /Unknown preset/)
  assert.throws(() => loadPreset('balanced/../../etc/passwd'), /Unknown preset/)
  assert.throws(() => loadPreset('not-a-preset'), /Unknown preset/)
})

test('assertStackName accepts safe names', () => {
  assert.equal(assertStackName('default'), 'default')
  assert.equal(assertStackName('dev_1'), 'dev_1')
  assert.equal(assertStackName('A-b_9'), 'A-b_9')
})

test('assertStackName rejects traversal and odd chars', () => {
  assert.throws(() => assertStackName('../evil'), /Invalid stack name/)
  assert.throws(() => assertStackName('a/b'), /Invalid stack name/)
  assert.throws(() => assertStackName('a\\b'), /Invalid stack name/)
  assert.throws(() => assertStackName('has space'), /Invalid stack name/)
  assert.throws(() => assertStackName(''), /Invalid stack name/)
})
