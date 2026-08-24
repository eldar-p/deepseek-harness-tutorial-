import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkSource, langForPath } from '../src/code-index/chunker.js'
import { hashEmbed, cosine } from '../src/code-index/embedder.js'
import { secretHeadersForHost } from '../src/secrets.js'

test('langForPath detects js', () => {
  assert.equal(langForPath('src/foo.ts'), 'js')
  assert.equal(langForPath('main.py'), 'py')
})

test('chunkSource extracts JS function', () => {
  const src = `export function add(a, b) {
  return a + b
}
`
  const chunks = chunkSource('math.js', src)
  assert.ok(chunks.some((c) => c.symbol === 'add' && c.kind === 'function'))
})

test('hashEmbed similar texts score higher', () => {
  const a = hashEmbed('function authenticate user token jwt')
  const b = hashEmbed('authenticate jwt token validation')
  const c = hashEmbed('completely unrelated database schema migration')
  assert.ok(cosine(a, b) > cosine(a, c))
})

test('secretHeadersForHost matches domain', () => {
  const secrets = { 'github.com': { Authorization: 'Bearer x' } }
  assert.equal(secretHeadersForHost('api.github.com', secrets).Authorization, 'Bearer x')
})
