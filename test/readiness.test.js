import test from 'node:test'
import assert from 'node:assert/strict'
import { assessPreAlphaReadiness, assessAlphaReadiness, assessReadiness, PREALPHA_MILESTONES, ALPHA_MILESTONES } from '../src/readiness.js'

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

test('ALPHA_MILESTONES weights sum to 100', () => {
  const sum = ALPHA_MILESTONES.reduce((s, m) => s + m.weight, 0)
  assert.equal(sum, 100)
})

test('assessAlphaReadiness returns pct and stage', () => {
  const r = assessAlphaReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, ALPHA_MILESTONES.length)
})

test('assessReadiness stage routing', () => {
  assert.equal(assessReadiness('alpha').items.length, ALPHA_MILESTONES.length)
  assert.equal(assessReadiness('pre-alpha').items.length, PREALPHA_MILESTONES.length)
})
