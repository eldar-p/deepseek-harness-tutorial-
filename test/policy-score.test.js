import test from 'node:test'
import assert from 'node:assert/strict'
import { assessPolicyScore, formatPolicyScoreReport } from '../src/policy-score.js'

test('assessPolicyScore near full on repo', () => {
  const r = assessPolicyScore()
  assert.ok(r.pct >= 90)
  assert.equal(r.grade, 'A')
  assert.ok(r.items.length >= 8)
})

test('formatPolicyScoreReport includes grade', () => {
  const text = formatPolicyScoreReport(assessPolicyScore())
  assert.match(text, /Policy score/)
  assert.match(text, /grade A/)
})
