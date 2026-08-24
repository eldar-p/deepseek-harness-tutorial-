import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAllowlist,
  guestNetworkArgs,
  guestNetworkEnv,
  guestCapabilityArgs,
  formatAllowlistLog,
  isGuestRunning,
  ensureGuestImage,
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

test('resolveAllowlist none empty', () => {
  assert.deepEqual(resolveAllowlist('none'), [])
})

test('guestNetworkEnv passes mode and csv allowlist', () => {
  const env = guestNetworkEnv('allowlist', ['a.example', 'b.example'])
  assert.equal(env.GIM_NET_MODE, 'allowlist')
  assert.equal(env.GIM_NET_ALLOWLIST, 'a.example,b.example')
})

test('guestNetworkArgs offline uses none network', () => {
  assert.deepEqual(guestNetworkArgs('offline'), ['--network', 'none'])
})

test('guestNetworkArgs open uses bridge', () => {
  assert.deepEqual(guestNetworkArgs('open'), ['--network', 'bridge'])
})

test('formatAllowlistLog offline', () => {
  assert.match(formatAllowlistLog('offline', []), /none/)
})

test('formatAllowlistLog allowlist mentions iptables', () => {
  assert.match(formatAllowlistLog('allowlist', ['a.com']), /iptables/)
})

test('formatAllowlistLog open warns', () => {
  assert.match(formatAllowlistLog('open', ['*']), /WARN/)
})

test('guestCapabilityArgs adds NET_ADMIN for allowlist', () => {
  assert.deepEqual(guestCapabilityArgs('allowlist'), ['--cap-add', 'NET_ADMIN'])
  assert.deepEqual(guestCapabilityArgs('offline'), [])
})

test('isGuestRunning reflects default stack when docker up', () => {
  const running = isGuestRunning('default')
  assert.equal(typeof running, 'boolean')
})

test('ensureGuestImage when engine ok', async () => {
  const r = await ensureGuestImage()
  assert.ok(r)
  assert.equal(typeof r.ok, 'boolean')
  if (r.ok) assert.ok(r.image)
})
