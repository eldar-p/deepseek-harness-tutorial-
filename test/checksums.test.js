import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sha256File, writeSha256Sidecar, verifySha256 } from '../src/checksums.js'

test('writeSha256Sidecar and verifySha256', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-sum-'))
  const file = path.join(dir, 'payload.bin')
  fs.writeFileSync(file, 'hello-deep')
  const hex = sha256File(file)
  const side = writeSha256Sidecar(file)
  assert.ok(fs.existsSync(side))
  assert.match(fs.readFileSync(side, 'utf8'), new RegExp(`^${hex}  payload\\.bin`))
  const ok = verifySha256(file)
  assert.equal(ok.ok, true)
  assert.equal(ok.got, hex)
})

test('verifySha256 mismatch and missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-sum-'))
  const file = path.join(dir, 'a.bin')
  fs.writeFileSync(file, 'x')
  const bad = verifySha256(file, { expected: '0'.repeat(64) })
  assert.equal(bad.ok, false)
  assert.match(bad.detail, /mismatch/)
  const miss = verifySha256(file)
  assert.equal(miss.ok, false)
  assert.match(miss.detail, /no expected/)
})
