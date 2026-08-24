import test from 'node:test'
import assert from 'node:assert/strict'
import { wantDsh, wantUi } from '../src/cli.js'
import { splitThoughts } from '../ui/thoughts.js'

test('wantDsh defaults off', () => {
  assert.equal(wantDsh({}), false)
  assert.equal(wantDsh({ dsh: true }), true)
  assert.equal(wantDsh({ 'no-dsh': true, dsh: true }), false)
})

test('wantUi defaults on', () => {
  assert.equal(wantUi({}), true)
  assert.equal(wantUi({ 'no-ui': true }), false)
})

test('splitThoughts extracts think blocks', () => {
  const { thoughts, visible } = splitThoughts('hi <think>plan</think> bye')
  assert.match(thoughts, /plan/)
  assert.match(visible, /hi/)
  assert.match(visible, /bye/)
  assert.doesNotMatch(visible, /plan/)
})
