#!/usr/bin/env node
/**
 * API-mode smoke without a real key: resolve provider + build DSH yaml + mock chat call.
 * Live mode: DEEP_API_SMOKE=1 + DEEP_API_KEY (or provider env).
 *
 * Usage: node scripts/smoke-api.mjs [--provider deepseek]
 */
import { resolveApiProfile, buildDshApiYaml, listApiProviderIds } from '../src/api-provider.js'

const provider =
  process.argv.find((a) => a.startsWith('--provider='))?.split('=')[1] ||
  process.env.DEEP_API_SMOKE_PROVIDER ||
  'deepseek'

const live = process.env.DEEP_API_SMOKE === '1' || process.env.DEEP_API_SMOKE === 'true'

console.log(`[smoke-api] providers: ${listApiProviderIds().join(', ')}`)

const profile = resolveApiProfile(
  {
    api: provider,
    'api-model': process.env.DEEP_API_MODEL,
    'api-base': process.env.DEEP_API_BASE,
    'api-key': live ? process.env.DEEP_API_KEY || process.env.DEEPSEEK_API_KEY : 'sk-smoke-test',
  },
  null,
)

const yaml = buildDshApiYaml(profile)
if (!yaml.includes(profile.model)) {
  console.error('[FAIL] yaml missing model')
  process.exit(1)
}
console.log(`[OK] profile ${profile.id} model=${profile.model} base=${profile.baseURL}`)
console.log(`[OK] dsh yaml ${yaml.split('\n').length} lines`)

const fetchFn = globalThis.fetch
const url = `${profile.baseURL.replace(/\/$/, '')}/chat/completions`
const body = {
  model: profile.model,
  messages: [{ role: 'user', content: 'ping' }],
  max_tokens: 8,
}

if (!live) {
  console.log('[OK] mock mode — skip live HTTP (set DEEP_API_SMOKE=1 to hit provider)')
  process.exit(0)
}

if (!profile.apiKey || profile.apiKey === 'sk-smoke-test') {
  console.error('[FAIL] live mode needs DEEP_API_KEY / provider key env')
  process.exit(1)
}

const res = await fetchFn(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${profile.apiKey}`,
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30_000),
})
const text = await res.text()
if (!res.ok) {
  console.error(`[FAIL] HTTP ${res.status}: ${text.slice(0, 200)}`)
  process.exit(1)
}
console.log(`[OK] live chat ${res.status} bytes=${text.length}`)
