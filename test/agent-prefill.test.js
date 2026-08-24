import test from 'node:test'
import assert from 'node:assert/strict'
import { batchTrailingToolResults, compactToolResult } from '../src/agent-prefill.js'

test('batchTrailingToolResults merges by default', () => {
  const prev = process.env.GIM_BATCH_TOOL_RESULTS
  delete process.env.GIM_BATCH_TOOL_RESULTS
  const msgs = [
    { role: 'user', content: 'hi' },
    { role: 'tool', tool_call_id: 'a', content: '{"ok":1}' },
    { role: 'tool', tool_call_id: 'b', content: '{"ok":2}' },
  ]
  const out = batchTrailingToolResults(msgs)
  assert.equal(out.length, 2)
  assert.equal(out.at(-1).role, 'user')
  assert.match(out.at(-1).content, /tool results batch/)
  if (prev === undefined) delete process.env.GIM_BATCH_TOOL_RESULTS
  else process.env.GIM_BATCH_TOOL_RESULTS = prev
})

test('batchTrailingToolResults disabled with env', () => {
  const prev = process.env.GIM_BATCH_TOOL_RESULTS
  process.env.GIM_BATCH_TOOL_RESULTS = '0'
  const msgs = [
    { role: 'tool', tool_call_id: 'a', content: '{}' },
    { role: 'tool', tool_call_id: 'b', content: '{}' },
  ]
  assert.equal(batchTrailingToolResults(msgs).length, 2)
  if (prev === undefined) delete process.env.GIM_BATCH_TOOL_RESULTS
  else process.env.GIM_BATCH_TOOL_RESULTS = prev
})

test('compactToolResult truncates long content', () => {
  const r = compactToolResult({ content: 'x'.repeat(30_000) })
  assert.equal(r.truncated, true)
  assert.ok(r.content.length <= 24_000)
})
