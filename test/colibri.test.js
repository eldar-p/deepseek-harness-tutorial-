import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  isColibriMode,
  colibriModelReady,
  resolveColibriModelPath,
  resolveColiLauncher,
  resolveColibriRoot,
  colibriStatus,
  resolvePython,
  DEFAULT_COLIBRI_MODEL_ID,
} from '../src/colibri.js'

test('isColibriMode flags and env', () => {
  assert.equal(isColibriMode({}, { colibri: true }), true)
  assert.equal(isColibriMode({}, { llm: 'colibri' }), true)
  assert.equal(isColibriMode({ llm: 'colibri' }, {}), true)
  assert.equal(isColibriMode({}, {}), false)
  const prev = process.env.GIM_LLM
  process.env.GIM_LLM = 'colibri'
  assert.equal(isColibriMode({}, {}), true)
  if (prev === undefined) delete process.env.GIM_LLM
  else process.env.GIM_LLM = prev
})

test('colibriModelReady missing dir', () => {
  const r = colibriModelReady(path.join(os.tmpdir(), `gim-no-model-${process.pid}`))
  assert.equal(r.ok, false)
  assert.match(r.detail, /missing/)
})

test('colibriModelReady valid mini model', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-model-'))
  fs.writeFileSync(path.join(dir, 'config.json'), '{}')
  fs.writeFileSync(path.join(dir, 'model-00001.safetensors'), 'x')
  const prev = process.env.GIM_COLIBRI_MIN_SHARDS
  process.env.GIM_COLIBRI_MIN_SHARDS = '1'
  const r = colibriModelReady(dir)
  assert.equal(r.ok, true)
  assert.equal(r.shards, 1)
  if (prev === undefined) delete process.env.GIM_COLIBRI_MIN_SHARDS
  else process.env.GIM_COLIBRI_MIN_SHARDS = prev
})

test('colibriModelReady incomplete index', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-model-'))
  fs.writeFileSync(path.join(dir, 'config.json'), '{}')
  fs.writeFileSync(path.join(dir, 'model-00001.safetensors'), 'x')
  fs.writeFileSync(
    path.join(dir, 'model.safetensors.index.json'),
    JSON.stringify({ weight_map: { a: 's1.safetensors', b: 's2.safetensors' } }),
  )
  const r = colibriModelReady(dir)
  assert.equal(r.ok, false)
  assert.match(r.detail, /incomplete/)
})

test('resolveColiLauncher with temp root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-coli-'))
  assert.equal(resolveColiLauncher(root), null)
  fs.writeFileSync(path.join(root, 'coli'), '#!/bin/sh\necho ok\n')
  assert.equal(resolveColiLauncher(root), path.join(root, 'coli'))
})

test('resolveColibriModelPath env override', () => {
  const custom = path.join(os.tmpdir(), `gim-custom-model-${process.pid}`)
  const prev = process.env.GIM_COLIBRI_MODEL
  process.env.GIM_COLIBRI_MODEL = custom
  assert.equal(resolveColibriModelPath({}), path.resolve(custom))
  if (prev === undefined) delete process.env.GIM_COLIBRI_MODEL
  else process.env.GIM_COLIBRI_MODEL = prev
})

test('colibriStatus shape', () => {
  const s = colibriStatus({})
  assert.ok('root' in s)
  assert.ok('modelReady' in s)
  assert.equal(s.modelId, process.env.GIM_COLIBRI_MODEL_ID || DEFAULT_COLIBRI_MODEL_ID)
})

test('resolvePython returns string or null', () => {
  const py = resolvePython()
  assert.ok(py === null || typeof py === 'string')
})

test('resolveColibriRoot respects GIM_COLIBRI_ROOT', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-root-'))
  const prev = process.env.GIM_COLIBRI_ROOT
  process.env.GIM_COLIBRI_ROOT = root
  assert.equal(resolveColibriRoot(), root)
  if (prev === undefined) delete process.env.GIM_COLIBRI_ROOT
  else process.env.GIM_COLIBRI_ROOT = prev
})
