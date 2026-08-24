import test from 'node:test'
import assert from 'node:assert/strict'
import { paint, row } from '../src/status-ui.js'

test('paint returns text without NO_COLOR', () => {
  const prev = process.env.NO_COLOR
  process.env.NO_COLOR = '1'
  assert.equal(paint('green', 'ok'), 'ok')
  if (prev === undefined) delete process.env.NO_COLOR
  else process.env.NO_COLOR = prev
})

test('row contains label', () => {
  const line = row('Engine', 'green', 'docker ok')
  assert.match(line, /Engine/)
  assert.match(line, /docker ok/)
})
