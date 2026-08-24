import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isPidAlive, findFileRecursive, runLogPath, killTree } from '../src/proc.js'

test('isPidAlive current process', () => {
  assert.equal(isPidAlive(process.pid), true)
})

test('isPidAlive falsy pid', () => {
  assert.equal(isPidAlive(0), false)
  assert.equal(isPidAlive(null), false)
})

test('isPidAlive dead pid', () => {
  assert.equal(isPidAlive(99999999), false)
})

test('findFileRecursive finds nested file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-find-'))
  try {
    const nest = path.join(root, 'a', 'b')
    fs.mkdirSync(nest, { recursive: true })
    const target = path.join(nest, 'llama-server.exe')
    fs.writeFileSync(target, 'x')
    assert.equal(findFileRecursive(root, ['llama-server.exe']), target)
    assert.equal(findFileRecursive(root, ['nope.bin']), null)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('runLogPath joins stack run dir', () => {
  const prev = process.env.DEEP_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-rlp-'))
  process.env.DEEP_HOME = home
  try {
    const p = runLogPath('s1', 'llama')
    assert.ok(p.includes('s1'))
    assert.ok(p.endsWith(`${path.sep}llama.log`) || p.endsWith('/llama.log'))
  } finally {
    if (prev === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('killTree no-op on falsy', () => {
  killTree(0)
  killTree(null)
})
