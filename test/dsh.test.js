import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { paths } from '../src/paths.js'
import { resolveDshBin, writeDshRuntimeSettings, stopDsh, dshStatusFromRun, startDsh } from '../src/dsh.js'

test('resolveDshBin respects DEEP_DSH_BIN', () => {
  const prev = process.env.DEEP_DSH_BIN
  const fake = path.join(paths().home, 'fake-dsh-bin')
  fs.mkdirSync(paths().home, { recursive: true })
  fs.writeFileSync(fake, 'x')
  process.env.DEEP_DSH_BIN = fake
  assert.equal(resolveDshBin(), fake)
  if (prev === undefined) delete process.env.DEEP_DSH_BIN
  else process.env.DEEP_DSH_BIN = prev
})

test('writeDshRuntimeSettings writes yaml and env', () => {
  const settingsPath = writeDshRuntimeSettings({ llamaPort: 18123, contextWindow: 4096 })
  assert.ok(fs.existsSync(settingsPath))
  const yaml = fs.readFileSync(settingsPath, 'utf8')
  assert.match(yaml, /baseURL: http:\/\/127\.0\.0\.1:18123\/v1/)
  assert.match(yaml, /defaultContextWindow: 4096/)
  const envPath = path.join(paths().dshHome, '.env')
  assert.ok(fs.existsSync(envPath))
  assert.match(fs.readFileSync(envPath, 'utf8'), /DEEP_LLAMA_API_KEY/)
})

test('stopDsh no-op on falsy', () => {
  stopDsh(null)
  stopDsh(0)
})

test('dshStatusFromRun levels', () => {
  assert.equal(dshStatusFromRun({}).level, 'red')
  assert.equal(dshStatusFromRun({ dshSkip: 'missing' }).detail, 'missing')
  assert.equal(dshStatusFromRun({ pids: { dsh: 999999991 } }).level, 'red')
  assert.equal(dshStatusFromRun({ pids: { dsh: process.pid }, urls: { dsh: 'http://x' } }).level, 'green')
})

test('startDsh without dsh binary returns not ok', async () => {
  const prev = process.env.DEEP_DSH_BIN
  const prevPath = process.env.Path || process.env.PATH
  // Point PATH away so which('dsh') fails; missing DEEP_DSH_BIN
  delete process.env.DEEP_DSH_BIN
  process.env.Path = 'C:\\Windows\\System32'
  process.env.PATH = process.env.Path
  try {
    const r = await startDsh({ stack: `utest-dsh-${process.pid}`, port: 19999, llamaPort: 19998 })
    assert.equal(r.ok, false)
    assert.match(r.detail, /dsh not on PATH/i)
  } finally {
    if (prev === undefined) delete process.env.DEEP_DSH_BIN
    else process.env.DEEP_DSH_BIN = prev
    process.env.Path = prevPath
    process.env.PATH = prevPath
  }
})
