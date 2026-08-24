import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sha256File, loadManifest } from '../src/download.js'

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
