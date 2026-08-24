import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { sha256File, loadManifest, ensureCachedAsset } from '../src/download.js'
import { paths } from '../src/paths.js'

test('loadManifest channels.json', () => {
  const m = loadManifest('channels.json')
  assert.ok(m.channel)
  assert.ok(m.revisions)
})

test('sha256File stable hash', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-sha-'))
  const f = path.join(tmp, 'x.txt')
  fs.writeFileSync(f, 'hello deep')
  const h = sha256File(f)
  assert.match(h, /^[a-f0-9]{64}$/)
  fs.rmSync(tmp, { recursive: true })
})

test('ensureCachedAsset hits cache when sha matches', async () => {
  const cacheName = `utest-asset-${process.pid}.bin`
  const dest = path.join(paths().manifestsCache, cacheName)
  fs.mkdirSync(paths().manifestsCache, { recursive: true })
  const body = Buffer.from('cached-asset')
  fs.writeFileSync(dest, body)
  const sha = createHash('sha256').update(body).digest('hex')
  const got = await ensureCachedAsset({
    url: 'https://example.invalid/never',
    sha256: sha,
    cacheName,
    label: 'utest',
  })
  assert.equal(got, dest)
  fs.unlinkSync(dest)
})

test('ensureCachedAsset requires url', async () => {
  await assert.rejects(() => ensureCachedAsset({ url: null, cacheName: 'x', label: 'x' }))
})
