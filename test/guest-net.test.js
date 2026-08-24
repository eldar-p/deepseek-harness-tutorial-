import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAllowlist,
  guestNetworkArgs,
  guestNetworkEnv,
  formatAllowlistLog,
} from '../src/guest.js'

test('resolveAllowlist maps allowlist preset to balanced domains', () => {
  const d = resolveAllowlist('allowlist')
  assert.ok(d.includes('github.com'))
  assert.ok(d.length >= 3)
})

test('resolveAllowlist offline is empty', () => {
  assert.deepEqual(resolveAllowlist('offline'), [])
})

test('resolveAllowlist open is wildcard', () => {
  assert.deepEqual(resolveAllowlist('open'), ['*'])
})

test('guestNetworkEnv passes mode and csv allowlist', () => {
  const env = guestNetworkEnv('allowlist', ['a.example', 'b.example'])
  assert.equal(env.DEEP_NET_MODE, 'allowlist')
  assert.equal(env.DEEP_NET_ALLOWLIST, 'a.example,b.example')
})

test('guestNetworkArgs offline uses none network', () => {
  assert.deepEqual(guestNetworkArgs('offline'), ['--network', 'none'])
})

test('formatAllowlistLog offline', () => {
  assert.match(formatAllowlistLog('offline', []), /none/)
})
