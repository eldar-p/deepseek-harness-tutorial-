import test from 'node:test'
import assert from 'node:assert/strict'
import { toFileUrl } from '../src/materialize.js'
import { toContainerHostPath, guestNetworkArgs } from '../src/guest.js'

test('toFileUrl on posix path', () => {
  if (process.platform === 'win32') return
  const u = toFileUrl('/tmp/gim/workspace')
  assert.ok(u.startsWith('file://'))
})

test('toFileUrl on win drive path', () => {
  if (process.platform !== 'win32') return
  const u = toFileUrl('C:\\Users\\test\\.gim')
  assert.ok(u.includes('file:///C|/'))
})

test('toContainerHostPath uses forward slashes on win', () => {
  if (process.platform !== 'win32') return
  const p = toContainerHostPath('C:\\Users\\x\\.gim\\ws')
  assert.ok(!p.includes('\\'))
})

test('guestNetworkArgs offline', () => {
  assert.deepEqual(guestNetworkArgs('offline'), ['--network', 'none'])
})

test('guestNetworkArgs allowlist uses bridge', () => {
  assert.deepEqual(guestNetworkArgs('allowlist'), ['--network', 'bridge'])
})
