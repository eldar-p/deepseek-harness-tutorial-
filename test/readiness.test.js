import test from 'node:test'
import assert from 'node:assert/strict'
import { assessPreAlphaReadiness, PREALPHA_MILESTONES } from '../src/readiness.js'

test('PREALPHA_MILESTONES weights sum to 100', () => {
  const sum = PREALPHA_MILESTONES.reduce((s, m) => s + m.weight, 0)
  assert.equal(sum, 100)
})

test('assessPreAlphaReadiness returns pct and stage', () => {
  const r = assessPreAlphaReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.ok(['early', 'mid', 'late', 'complete'].includes(r.stage))
  assert.equal(r.items.length, PREALPHA_MILESTONES.length)
})
