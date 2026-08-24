import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { paths } from '../src/paths.js'
import { readGpuLock, withGpuLock, gpuLockHolder } from '../src/gpu-lock.js'

function clearLock() {
  const p = paths().lockGpu
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    /* */
  }
}

test('readGpuLock null when missing', () => {
  clearLock()
  assert.equal(readGpuLock(), null)
})

test('readGpuLock parses legacy pid and JSON', () => {
  clearLock()
  const p = paths().lockGpu
  fs.mkdirSync(paths().home, { recursive: true })
  fs.writeFileSync(p, String(process.pid))
  assert.deepEqual(readGpuLock(), { pid: process.pid, stack: null })
  fs.writeFileSync(p, JSON.stringify({ pid: process.pid, stack: 'dev' }))
  assert.deepEqual(readGpuLock(), { pid: process.pid, stack: 'dev' })
  clearLock()
})

test('withGpuLock acquires and releases', async () => {
  clearLock()
  let ran = false
  await withGpuLock(async () => {
    ran = true
    const held = readGpuLock()
    assert.equal(held.pid, process.pid)
    assert.equal(held.stack, 'utest')
  }, { stack: 'utest', timeoutMs: 5_000 })
  assert.equal(ran, true)
  assert.equal(readGpuLock(), null)
})

test('gpuLockHolder sees other stack', async () => {
  clearLock()
  await withGpuLock(async () => {
    assert.equal(gpuLockHolder('utest'), null)
    assert.equal(gpuLockHolder('other'), 'utest')
  }, { stack: 'utest', timeoutMs: 5_000 })
})

test('withGpuLock times out when held', async () => {
  clearLock()
  const p = paths().lockGpu
  fs.mkdirSync(paths().home, { recursive: true })
  fs.writeFileSync(p, JSON.stringify({ pid: process.pid, stack: 'blocker' }))
  await assert.rejects(
    () => withGpuLock(async () => {}, { stack: 'waiter', timeoutMs: 250 }),
    (e) => e.exitCode === 3 && /GPU lock timeout/.test(e.message),
  )
  clearLock()
})
