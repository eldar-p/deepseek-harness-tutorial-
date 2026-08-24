import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  resolveArtifactSource,
  findExtractedRoot,
  writeDeepShim,
  installFromZip,
} from '../src/cli-install.js'

test('resolveArtifactSource http', () => {
  const s = resolveArtifactSource('https://example.com/a.zip')
  assert.equal(s.kind, 'http')
})

test('resolveArtifactSource file url', () => {
  const s = resolveArtifactSource('file:///C:/tmp/deep.zip')
  assert.equal(s.kind, 'file')
  assert.match(s.path, /deep\.zip$/i)
})

test('findExtractedRoot nested', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-ex-'))
  try {
    const nest = path.join(base, 'pkg')
    fs.mkdirSync(path.join(nest, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(nest, 'bin', 'deep.js'), '#!/usr/bin/env node\n')
    assert.equal(findExtractedRoot(base), nest)
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('writeDeepShim creates launcher', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-shim-'))
  const prev = process.env.DEEP_PREFIX
  process.env.DEEP_PREFIX = path.join(home, 'bin')
  try {
    const root = path.join(home, 'pkg')
    fs.mkdirSync(path.join(root, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(root, 'bin', 'deep.js'), 'console.log(1)\n')
    const out = writeDeepShim(root, '0.0.0-test')
    assert.ok(fs.existsSync(out.shim))
  } finally {
    if (prev === undefined) delete process.env.DEEP_PREFIX
    else process.env.DEEP_PREFIX = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('installFromZip roundtrip when zip exists from pack', async () => {
  const zip = path.resolve('dist/deep-cli-0.2.0-alpha.zip')
  if (!fs.existsSync(zip)) return
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-home-'))
  const prevHome = process.env.DEEP_HOME
  const prevPrefix = process.env.DEEP_PREFIX
  process.env.DEEP_HOME = home
  process.env.DEEP_PREFIX = path.join(home, 'bin')
  try {
    const r = installFromZip(zip, '0.2.0-alpha-test')
    assert.ok(fs.existsSync(path.join(r.installRoot, 'bin', 'deep.js')))
    assert.ok(fs.existsSync(r.shim))
  } finally {
    if (prevHome === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prevHome
    if (prevPrefix === undefined) delete process.env.DEEP_PREFIX
    else process.env.DEEP_PREFIX = prevPrefix
    fs.rmSync(home, { recursive: true, force: true })
  }
})
