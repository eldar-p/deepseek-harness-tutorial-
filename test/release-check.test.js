import test from 'node:test'
import assert from 'node:assert/strict'
import { runReleaseCheck, formatReleaseCheckReport } from '../src/release-check.js'

test('runReleaseCheck returns structured report', () => {
  const r = runReleaseCheck()
  assert.ok('ok' in r)
  assert.ok(Array.isArray(r.blockers))
  assert.ok(r.readiness)
  assert.ok(r.security)
  assert.equal(r.audits.length, 2)
})

test('formatReleaseCheckReport includes gate line', () => {
  const r = runReleaseCheck()
  const text = formatReleaseCheckReport(r)
  assert.match(text, /Release gate:/)
  assert.match(text, /security/i)
})
