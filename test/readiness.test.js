import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assessPreAlphaReadiness,
  assessAlphaReadiness,
  assessBetaReadiness,
  assessRcReadiness,
  assessCoreReadiness,
  assessV1Readiness,
  assessV11Readiness,
  assessReadiness,
  PREALPHA_MILESTONES,
  ALPHA_MILESTONES,
  BETA_MILESTONES,
  RC_MILESTONES,
  CORE_MILESTONES,
  V1_MILESTONES,
  V11_MILESTONES,
} from '../src/readiness.js'

test('PREALPHA_MILESTONES weights sum to 100', () => {
  assert.equal(PREALPHA_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessPreAlphaReadiness returns pct and stage', () => {
  const r = assessPreAlphaReadiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, PREALPHA_MILESTONES.length)
})

test('ALPHA_MILESTONES weights sum to 100', () => {
  assert.equal(ALPHA_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessAlphaReadiness returns pct and stage', () => {
  assert.equal(assessAlphaReadiness().items.length, ALPHA_MILESTONES.length)
})

test('BETA_MILESTONES weights sum to 100', () => {
  assert.equal(BETA_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessBetaReadiness returns pct and stage', () => {
  assert.equal(assessBetaReadiness().items.length, BETA_MILESTONES.length)
})

test('RC_MILESTONES weights sum to 100', () => {
  assert.equal(RC_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessRcReadiness returns pct and stage', () => {
  assert.equal(assessRcReadiness().items.length, RC_MILESTONES.length)
})

test('CORE_MILESTONES weights sum to 100', () => {
  assert.equal(CORE_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessCoreReadiness returns pct and stage', () => {
  assert.equal(assessCoreReadiness().items.length, CORE_MILESTONES.length)
})

test('V1_MILESTONES weights sum to 100', () => {
  assert.equal(V1_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessV1Readiness returns pct and stage', () => {
  const r = assessV1Readiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, V1_MILESTONES.length)
})

test('V11_MILESTONES weights sum to 100', () => {
  assert.equal(V11_MILESTONES.reduce((s, m) => s + m.weight, 0), 100)
})

test('assessV11Readiness returns pct and stage', () => {
  const r = assessV11Readiness()
  assert.ok(r.pct >= 0 && r.pct <= 100)
  assert.equal(r.items.length, V11_MILESTONES.length)
})

test('assessReadiness stage routing', () => {
  assert.equal(assessReadiness('1.1').items.length, V11_MILESTONES.length)
  assert.equal(assessReadiness('1.0').items.length, V1_MILESTONES.length)
  assert.equal(assessReadiness('v1').items.length, V1_MILESTONES.length)
  assert.equal(assessReadiness('0.5').items.length, CORE_MILESTONES.length)
  assert.equal(assessReadiness('rc').items.length, RC_MILESTONES.length)
  assert.equal(assessReadiness('beta').items.length, BETA_MILESTONES.length)
  assert.equal(assessReadiness('alpha').items.length, ALPHA_MILESTONES.length)
  assert.equal(assessReadiness('pre-alpha').items.length, PREALPHA_MILESTONES.length)
})
