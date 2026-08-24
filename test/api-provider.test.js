import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

test('resolveApiProfile rejects unknown and missing provider', () => {
  assert.throws(() => resolveApiProfile({}, null), /No API provider/)
  assert.throws(() => resolveApiProfile({ api: 'nope' }, null), /Unknown API provider/)
})

test('saveApiToConfig and writeApiKeyToDshEnv', async () => {
  const prev = process.env.DEEP_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-api-'))
  process.env.DEEP_HOME = home
  try {
    const { saveApiToConfig, writeApiKeyToDshEnv } = await import('../src/api-provider.js')
    const profile = resolveApiProfile(
      { api: 'openai', 'api-model': 'gpt-4o-mini', 'api-key': 'sk-x' },
      null,
    )
    const cfg = saveApiToConfig({}, profile)
    assert.equal(cfg.api.provider, 'openai')
    writeApiKeyToDshEnv(profile)
    writeApiKeyToDshEnv(profile) // rewrite same key
    const envText = fs.readFileSync(path.join(home, 'dsh-home', '.env'), 'utf8')
    assert.match(envText, /OPENAI_API_KEY=sk-x/)
  } finally {
    if (prev === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
