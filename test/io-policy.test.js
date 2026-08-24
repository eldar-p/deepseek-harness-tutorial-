import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { rotateLogIfLarge, cleanStalePartFiles, GIM_LOG_MAX_BYTES } from '../src/io-policy.js'

test('rotateLogIfLarge rotates when over cap', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-io-'))
  const log = path.join(dir, 'gim.log')
  fs.writeFileSync(log, 'x'.repeat(GIM_LOG_MAX_BYTES + 100))
  assert.equal(rotateLogIfLarge(log, { maxBytes: 100 }), true)
  assert.ok(fs.existsSync(path.join(dir, 'gim.log.1')))
  fs.rmSync(dir, { recursive: true })
})

test('cleanStalePartFiles removes old part files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-part-'))
  const part = path.join(dir, 'dl.part')
  fs.writeFileSync(part, 'partial')
  const old = Date.now() - 7200_000
  fs.utimesSync(part, old / 1000, old / 1000)
  assert.equal(cleanStalePartFiles(dir, { maxAgeMs: 3600_000 }), 1)
  assert.ok(!fs.existsSync(part))
  fs.rmSync(dir, { recursive: true })
})
