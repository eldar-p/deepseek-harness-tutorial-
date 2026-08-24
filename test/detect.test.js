import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { nodeOk, detectOsFamily, isRoot, engineEnv, hostSummary, detectGpu, resolveEngineBin } from '../src/detect.js'

test('nodeOk on current runtime', () => {
  assert.equal(nodeOk(), Number(process.versions.node.split('.')[0]) >= 22)
})

test('detectOsFamily returns string', () => {
  const f = detectOsFamily()
  assert.ok(['windows', 'mac', 'linux', 'debian', 'fedora'].includes(f))
})

test('isRoot false on win32', () => {
  if (process.platform === 'win32') assert.equal(isRoot(), false)
})

test('engineEnv prepends bin dir', () => {
  const fake = path.join(os.tmpdir(), 'gim-docker-fake', 'docker.exe')
  fs.mkdirSync(path.dirname(fake), { recursive: true })
  fs.writeFileSync(fake, 'x')
  const env = engineEnv(fake)
  const dir = path.dirname(fake).toLowerCase()
  assert.ok(String(env.Path || env.PATH).toLowerCase().includes(dir))
  if (process.platform === 'win32') {
    assert.ok(String(env.PATH).toLowerCase().includes(dir))
    assert.ok(String(env.Path).toLowerCase().includes(dir))
  }
})

test('engineEnv null is identity', () => {
  assert.equal(engineEnv(null), process.env)
})

test('hostSummary shape', () => {
  const h = hostSummary()
  assert.ok(h.platform)
  assert.ok(h.node)
  assert.ok(h.cpus >= 1)
})

test('detectGpu returns kind', () => {
  const g = detectGpu()
  assert.ok(['nvidia', 'metal', 'cpu'].includes(g.kind))
})

test('resolveEngineBin with GIM_DOCKER_BIN', () => {
  const prev = process.env.GIM_DOCKER_BIN
  const fake = path.join(os.tmpdir(), `deep-eng-${process.pid}.exe`)
  fs.writeFileSync(fake, 'x')
  process.env.GIM_DOCKER_BIN = fake
  try {
    assert.equal(resolveEngineBin('docker'), fake)
  } finally {
    if (prev === undefined) delete process.env.GIM_DOCKER_BIN
    else process.env.GIM_DOCKER_BIN = prev
    try {
      fs.unlinkSync(fake)
    } catch {
      /* */
    }
  }
})
