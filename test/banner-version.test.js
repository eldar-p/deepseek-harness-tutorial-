import test from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, assessVersionFreshness, checkDependencies } from '../src/version-check.js'
import { loadAsciiArt, bannerEnabled } from '../src/banner.js'

test('compareVersions ordering', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('0.9.0', '1.0.0'), -1)
  assert.equal(compareVersions('1.0.0', '0.9.0-rc.0'), 1)
  assert.equal(compareVersions('1.0.0-rc.0', '1.0.0'), -1)
})

test('assessVersionFreshness returns status', () => {
  const r = assessVersionFreshness('stable')
  assert.ok(r.local)
  assert.ok(['current', 'outdated', 'ahead', 'unknown'].includes(r.status))
})

test('checkDependencies returns items', () => {
  const r = checkDependencies()
  assert.ok(Array.isArray(r.items))
  assert.ok(r.items.some((i) => i.id === 'node'))
  assert.ok(r.items.some((i) => i.id === 'engine'))
})

test('loadAsciiArt contains Deep shape', () => {
  const art = loadAsciiArt()
  assert.ok(art.includes('____'))
  assert.ok(art.includes('/\\  _'))
})

test('bannerEnabled respects DEEP_NO_BANNER', () => {
  const prev = process.env.DEEP_NO_BANNER
  process.env.DEEP_NO_BANNER = '1'
  try {
    assert.equal(bannerEnabled(), false)
  } finally {
    if (prev === undefined) delete process.env.DEEP_NO_BANNER
    else process.env.DEEP_NO_BANNER = prev
  }
})
