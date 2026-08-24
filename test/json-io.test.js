import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { stripBom, readJsonFile, writeJsonFile } from '../src/json-io.js'

test('stripBom removes UTF-8 BOM', () => {
  assert.equal(stripBom('\uFEFF{"a":1}'), '{"a":1}')
  assert.equal(stripBom('{"a":1}'), '{"a":1}')
})

test('readJsonFile tolerates BOM', () => {
  const f = path.join(os.tmpdir(), `deep-bom-${process.pid}.json`)
  fs.writeFileSync(f, Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from('{"ok":true}', 'utf8')]))
  try {
    assert.deepEqual(readJsonFile(f), { ok: true })
  } finally {
    fs.unlinkSync(f)
  }
})

test('writeJsonFile roundtrip no BOM', () => {
  const f = path.join(os.tmpdir(), `deep-nobom-${process.pid}.json`)
  writeJsonFile(f, { x: 1 })
  try {
    const buf = fs.readFileSync(f)
    assert.notEqual(buf[0], 0xef)
    assert.deepEqual(readJsonFile(f), { x: 1 })
  } finally {
    fs.unlinkSync(f)
  }
})
