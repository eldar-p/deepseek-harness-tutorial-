import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiProfile, isApiMode, buildDshApiYaml, listApiProviderIds } from '../src/api-provider.js'

test('listApiProviderIds includes deepseek and openai', () => {
  const ids = listApiProviderIds()
  assert.ok(ids.includes('deepseek'))
  assert.ok(ids.includes('openai'))
})

test('resolveApiProfile deepseek preset', () => {
  const p = resolveApiProfile({ api: 'deepseek', 'api-model': 'deepseek-chat', 'api-key': 'sk-test' }, null)
  assert.equal(p.id, 'deepseek')
  assert.equal(p.model, 'deepseek-chat')
  assert.match(p.baseURL, /deepseek\.com/)
  assert.equal(p.apiKeyEnv, 'DEEPSEEK_API_KEY')
})

test('resolveApiProfile custom needs base URL', () => {
  assert.throws(
    () => resolveApiProfile({ api: 'custom' }, null),
    /api-base/,
  )
  const p = resolveApiProfile(
    { api: 'custom', 'api-base': 'https://llm.example.com/v1', 'api-model': 'm1', 'api-key': 'k' },
    null,
  )
  assert.equal(p.baseURL, 'https://llm.example.com/v1')
})

test('isApiMode prefers local when gguf set', () => {
  assert.equal(isApiMode({ api: { provider: 'openai' }, gguf: 'C:\\m.gguf' }, {}), false)
  assert.equal(isApiMode({ api: { provider: 'openai' } }, {}), true)
})

test('buildDshApiYaml contains provider block', () => {
  const yaml = buildDshApiYaml({
    id: 'deepseek',
    displayName: 'DeepSeek',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    contextWindow: 65536,
    maxTokens: 8192,
    supportsDeveloperRole: false,
  })
  assert.match(yaml, /provider: deepseek/)
  assert.match(yaml, /baseURL: https:\/\/api\.deepseek\.com\/v1/)
})
