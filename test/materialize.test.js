import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { materializeAssets, toFileUrl } from '../src/materialize.js'

test('materializeAssets seeds memory.json and jail-core sync', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-mat-'))
  const prev = process.env.DEEP_HOME
  process.env.DEEP_HOME = base
  try {
    materializeAssets('mat-test')
    const ws = path.join(base, 'workspace', 'mat-test')
    const mem = path.join(ws, '.deep', 'memory.json')
    assert.ok(fs.existsSync(mem))
    const j = JSON.parse(fs.readFileSync(mem, 'utf8'))
    assert.equal(j.version, 1)
    assert.ok(Array.isArray(j.facts))

    const jailCore = path.join(base, 'dsh-home', 'profiles', 'web', 'dsh-plugins', 'workspace-jail-fs', 'jail-core.mjs')
    assert.ok(fs.existsSync(jailCore))
    assert.match(fs.readFileSync(jailCore, 'utf8'), /rewriteWorkspacePath/)

    const patch = path.join(base, 'dsh-home', 'profiles', 'web', 'cordis.patch.yml')
    assert.ok(fs.existsSync(patch))
    const patchText = fs.readFileSync(patch, 'utf8')
    assert.match(patchText, /workspace-jail-fs/)
    assert.match(patchText, /lsp-bridge/)
    if (process.platform === 'win32') {
      assert.match(patchText, /file:\/\/\/[A-Za-z]\|/)
    } else {
      assert.match(patchText, /file:\/\/\//)
    }
  } finally {
    if (prev === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prev
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('toFileUrl returns file scheme', () => {
  const u = toFileUrl(path.join(os.tmpdir(), 'deep'))
  assert.ok(u.startsWith('file://'))
})
