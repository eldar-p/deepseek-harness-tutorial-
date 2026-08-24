import test from 'node:test'
import assert from 'node:assert/strict'
import {
  runSecurityEval,
  SECURITY_SCENARIOS,
  createSecurityEvalContext,
  SECURITY_EVAL_BAR,
} from '../src/security-eval.js'
import { runAgentTool } from '../src/agent-tools.js'

test('SECURITY_SCENARIOS has enforcement and static cases', () => {
  assert.ok(SECURITY_SCENARIOS.length >= 20)
  assert.ok(SECURITY_SCENARIOS.some((s) => s.category === 'enforcement'))
  assert.ok(SECURITY_SCENARIOS.some((s) => s.category === 'static'))
})

test('runSecurityEval meets bar on repo', () => {
  const r = runSecurityEval()
  assert.ok(r.total >= 20)
  assert.ok(r.pct >= SECURITY_EVAL_BAR, `security ${r.passed}/${r.total} below bar`)
  assert.equal(r.ok, true)
})

test('createSecurityEvalContext isolates GIM_HOME', () => {
  const ctx = createSecurityEvalContext('unit-sec')
  try {
    const denied = runAgentTool(ctx.stack, 'write_file', { path: '.env', content: 'x' })
    assert.equal(denied.ok, false)
  } finally {
    ctx.cleanup?.()
  }
})
