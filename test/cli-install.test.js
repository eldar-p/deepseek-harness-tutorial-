import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  resolveArtifactSource,
  findExtractedRoot,
  writeGimShim,
  installFromZip,
} from '../src/cli-install.js'

test('resolveArtifactSource http', () => {
  const s = resolveArtifactSource('https://example.com/a.zip')
  assert.equal(s.kind, 'http')
})

test('resolveArtifactSource file url', () => {
  const s = resolveArtifactSource('file:///C:/tmp/gim.zip')
  assert.equal(s.kind, 'file')
  assert.match(s.path, /gim\.zip$/i)
})

test('findExtractedRoot nested', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ex-'))
  try {
    const nest = path.join(base, 'pkg')
    fs.mkdirSync(path.join(nest, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(nest, 'bin', 'gim.js'), '#!/usr/bin/env node\n')
    assert.equal(findExtractedRoot(base), nest)
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('writeGimShim creates launcher', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-shim-'))
  const prev = process.env.GIM_PREFIX
  process.env.GIM_PREFIX = path.join(home, 'bin')
  try {
    const root = path.join(home, 'pkg')
    fs.mkdirSync(path.join(root, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(root, 'bin', 'gim.js'), 'console.log(1)\n')
    const out = writeGimShim(root, '0.0.0-test')
    assert.ok(fs.existsSync(out.shim))
  } finally {
    if (prev === undefined) delete process.env.GIM_PREFIX
    else process.env.GIM_PREFIX = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('installFromZip roundtrip when zip exists from pack', async () => {
  const zip = path.resolve('dist/gim-cli-0.2.0-alpha.zip')
  if (!fs.existsSync(zip)) return
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-home-'))
  const prevHome = process.env.GIM_HOME
  const prevPrefix = process.env.GIM_PREFIX
  process.env.GIM_HOME = home
  process.env.GIM_PREFIX = path.join(home, 'bin')
  try {
    const r = installFromZip(zip, '0.2.0-alpha-test')
    assert.ok(fs.existsSync(path.join(r.installRoot, 'bin', 'gim.js')))
    assert.ok(fs.existsSync(r.shim))
  } finally {
    if (prevHome === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prevHome
    if (prevPrefix === undefined) delete process.env.GIM_PREFIX
    else process.env.GIM_PREFIX = prevPrefix
    fs.rmSync(home, { recursive: true, force: true })
  }
})
