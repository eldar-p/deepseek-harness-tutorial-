import test from 'node:test'
import assert from 'node:assert/strict'
import { isColibriMode, colibriModelReady, resolveColibriModelPath } from '../src/colibri.js'
import { defaultColibriModelDir } from '../src/platform-paths.js'

test('isColibriMode flags', () => {
  assert.equal(isColibriMode({}, { colibri: true }), true)
  assert.equal(isColibriMode({}, { llm: 'colibri' }), true)
  assert.equal(isColibriMode({ llm: 'colibri' }, {}), true)
  assert.equal(isColibriMode({}, {}), false)
})

test('default model path uses platform resolver', () => {
  assert.equal(resolveColibriModelPath({}), defaultColibriModelDir())
})

test('colibriModelReady reports missing shards without failing hard', () => {
  const r = colibriModelReady(defaultColibriModelDir())
  assert.ok('ok' in r)
  assert.ok('shards' in r)
})
