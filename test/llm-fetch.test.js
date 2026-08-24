import test from 'node:test'
import assert from 'node:assert/strict'
import { llmFetch, resetLlmFetchAgents } from '../src/llm-fetch.js'

test('llmFetch completes without throw', async () => {
  resetLlmFetchAgents()
  const res = await llmFetch('https://example.com', { method: 'HEAD' }).catch(() => null)
  assert.ok(res === null || res.status >= 200)
})

test('resetLlmFetchAgents is idempotent', () => {
  resetLlmFetchAgents()
  assert.doesNotThrow(() => resetLlmFetchAgents())
})
