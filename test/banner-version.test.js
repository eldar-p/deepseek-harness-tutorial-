import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

test('printBanner and welcome helpers', async () => {
  const prevHome = process.env.DEEP_HOME
  const prevBanner = process.env.DEEP_NO_BANNER
  const prevCi = process.env.CI
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-ban-'))
  process.env.DEEP_HOME = home
  delete process.env.DEEP_NO_BANNER
  delete process.env.CI
  try {
    const {
      printBanner,
      maybePrintFirstRunWelcome,
      isFirstRun,
      markWelcomed,
      readPkgVersion,
    } = await import('../src/banner.js')
    assert.ok(readPkgVersion())
    assert.equal(isFirstRun(), true)
    printBanner({ tagline: true })
    assert.equal(maybePrintFirstRunWelcome(), true)
    assert.equal(isFirstRun(), false)
    markWelcomed()
    assert.equal(maybePrintFirstRunWelcome(), false)
  } finally {
    if (prevHome === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prevHome
    if (prevBanner === undefined) delete process.env.DEEP_NO_BANNER
    else process.env.DEEP_NO_BANNER = prevBanner
    if (prevCi === undefined) delete process.env.CI
    else process.env.CI = prevCi
    fs.rmSync(home, { recursive: true, force: true })
  }
})
