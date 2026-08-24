import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  defaultModelsDir,
  defaultColibriRoot,
  defaultColibriModelDir,
} from '../src/platform-paths.js'

test('defaultModelsDir returns path under gim home', () => {
  const d = defaultModelsDir()
  assert.ok(typeof d === 'string')
  assert.ok(d.length > 0)
})

test('defaultColibriRoot uses GIM_COLIBRI_ROOT', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-pp-'))
  const prev = process.env.GIM_COLIBRI_ROOT
  process.env.GIM_COLIBRI_ROOT = root
  assert.equal(defaultColibriRoot(), root)
  if (prev === undefined) delete process.env.GIM_COLIBRI_ROOT
  else process.env.GIM_COLIBRI_ROOT = prev
})

test('defaultColibriRoot finds coli binary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-nested-'))
  fs.writeFileSync(path.join(root, 'coli'), '#!/bin/sh\n')
  const prev = process.env.GIM_COLIBRI_ROOT
  process.env.GIM_COLIBRI_ROOT = root
  assert.equal(defaultColibriRoot(), root)
  if (prev === undefined) delete process.env.GIM_COLIBRI_ROOT
  else process.env.GIM_COLIBRI_ROOT = prev
})

test('defaultColibriModelDir env override', () => {
  const model = path.join(os.tmpdir(), `gim-model-dir-${process.pid}`)
  const prev = process.env.GIM_COLIBRI_MODEL
  process.env.GIM_COLIBRI_MODEL = model
  assert.equal(defaultColibriModelDir(), model)
  if (prev === undefined) delete process.env.GIM_COLIBRI_MODEL
  else process.env.GIM_COLIBRI_MODEL = prev
})

test('defaultColibriModelDir picks existing config.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mdir-'))
  fs.writeFileSync(path.join(dir, 'config.json'), '{}')
  const prev = process.env.GIM_COLIBRI_MODEL
  process.env.GIM_COLIBRI_MODEL = dir
  assert.equal(defaultColibriModelDir('AnyName'), dir)
  if (prev === undefined) delete process.env.GIM_COLIBRI_MODEL
  else process.env.GIM_COLIBRI_MODEL = prev
})
