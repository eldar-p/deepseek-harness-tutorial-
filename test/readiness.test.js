import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assessPreAlphaReadiness,
  assessAlphaReadiness,
  assessBetaReadiness,
  assessRcReadiness,
  assessCoreReadiness,
  assessReadiness,
  PREALPHA_MILESTONES,
  ALPHA_MILESTONES,
  BETA_MILESTONES,
  RC_MILESTONES,
  CORE_MILESTONES,
} from '../src/readiness.js'

test('PREALPHA_MILESTONES weights sum to 100', () => {
  assert.equal(PREALPHA_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessPreAlphaReadiness returns pct and stage', () => {
  const r = assessPreAlphaReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.ok(['early', 'mid', 'late', 'complete'].includes(r.stage))
  assert.equal(r.items.length, PREALPHA_MILESTONES.length)
})

test('ALPHA_MILESTONES weights sum to 100', () => {
  assert.equal(ALPHA_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessAlphaReadiness returns pct and stage', () => {
  const r = assessAlphaReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, ALPHA_MILESTONES.length)
})

test('BETA_MILESTONES weights sum to 100', () => {
  assert.equal(BETA_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessBetaReadiness returns pct and stage', () => {
  const r = assessBetaReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, BETA_MILESTONES.length)
})

test('RC_MILESTONES weights sum to 100', () => {
  assert.equal(RC_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessRcReadiness returns pct and stage', () => {
  const r = assessRcReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, RC_MILESTONES.length)
})

test('CORE_MILESTONES weights sum to 100', () => {
  assert.equal(CORE_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessCoreReadiness returns pct and stage', () => {
  const r = assessCoreReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, CORE_MILESTONES.length)
})

test('assessReadiness stage routing', () => {
  assert.equal(assessReadiness('0.5').items.length, CORE_MILESTONES.length)
  assert.equal(assessReadiness('core').items.length, CORE_MILESTONES.length)
  assert.equal(assessReadiness('rc').items.length, RC_MILESTONES.length)
  assert.equal(assessReadiness('beta').items.length, BETA_MILESTONES.length)
  assert.equal(assessReadiness('alpha').items.length, ALPHA_MILESTONES.length)
  assert.equal(assessReadiness('pre-alpha').items.length, PREALPHA_MILESTONES.length)
})
