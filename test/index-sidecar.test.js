import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  pickIndexSidecarEntry,
  resolveNativeIndexSidecarBin,
  resolveLocalIndexSidecarBuild,
  buildIndexSidecarSpawnSpec,
  jsIndexSidecarScript,
  assessIndexSidecar,
  formatIndexSidecarReport,
  prepareCodeIndexSpawn,
  spawnCodeIndexService,
} from '../src/index-sidecar.js'
import { loadManifest } from '../src/download.js'

test('resolveLocalIndexSidecarBuild returns null without cargo output', () => {
  assert.equal(resolveLocalIndexSidecarBuild(), null)
})

test('pickIndexSidecarEntry matches platform', () => {
  const man = loadManifest('index-sidecar.json')
  const entry = pickIndexSidecarEntry(man)
  assert.ok(entry)
  assert.ok(entry.binaryName)
})

test('resolveNativeIndexSidecarBin defaults to js when GIM_INDEX_SIDECAR=js', () => {
  const prev = process.env.GIM_INDEX_SIDECAR
  process.env.GIM_INDEX_SIDECAR = 'js'
  try {
    assert.equal(resolveNativeIndexSidecarBin(), null)
  } finally {
    if (prev === undefined) delete process.env.GIM_INDEX_SIDECAR
    else process.env.GIM_INDEX_SIDECAR = prev
  }
})

test('buildIndexSidecarSpawnSpec uses js script fallback', () => {
  const prev = process.env.GIM_INDEX_SIDECAR
  process.env.GIM_INDEX_SIDECAR = 'js'
  try {
    const spec = buildIndexSidecarSpawnSpec({
      port: 14150,
      workspaceRoot: process.cwd(),
    })
    assert.equal(spec.backend, 'js')
    assert.ok(spec.args[0].endsWith('gim-index-sidecar.mjs'))
    assert.equal(spec.env.GIM_INDEX_PORT, '14150')
  } finally {
    if (prev === undefined) delete process.env.GIM_INDEX_SIDECAR
    else process.env.GIM_INDEX_SIDECAR = prev
  }
})

test('jsIndexSidecarScript exists', () => {
  assert.ok(fs.existsSync(jsIndexSidecarScript()))
})

test('assessIndexSidecar report', async () => {
  const report = await assessIndexSidecar()
  assert.equal(report.activeBackend, 'js')
  assert.match(formatIndexSidecarReport(report), /Index sidecar/)
})

test('native spawn spec when GIM_INDEX_SIDECAR points to file', () => {
  const prev = process.env.GIM_INDEX_SIDECAR
  const fake = path.join(process.cwd(), 'package.json')
  process.env.GIM_INDEX_SIDECAR = fake
  try {
    const native = resolveNativeIndexSidecarBin()
    assert.equal(native?.bin, path.resolve(fake))
    const spec = buildIndexSidecarSpawnSpec({ port: 9999, workspaceRoot: process.cwd() })
    assert.equal(spec.backend, 'native')
    assert.equal(spec.cmd, path.resolve(fake))
    assert.deepEqual(spec.args.slice(0, 2), ['--port', '9999'])
  } finally {
    if (prev === undefined) delete process.env.GIM_INDEX_SIDECAR
    else process.env.GIM_INDEX_SIDECAR = prev
  }
})
