import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveGguf, pickBinaryEntry, hostThreads, llamaStatusFromRun, stopLlama } from '../src/llama.js'

test('hostThreads in range', () => {
  const n = hostThreads()
  assert.ok(n >= 2 && n <= 8)
})

test('pickBinaryEntry prefers cuda when requested', () => {
  const man = {
    binaries: [
      { os: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux', arch: process.arch === 'arm64' ? 'arm64' : 'x64', variant: 'cpu', url: 'u1', sha256: 'a' },
      { os: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux', arch: process.arch === 'arm64' ? 'arm64' : 'x64', variant: 'cuda', url: 'u2', sha256: 'b' },
    ],
  }
  assert.equal(pickBinaryEntry(man, { preferCuda: true }).variant, 'cuda')
  assert.equal(pickBinaryEntry(man, { preferCuda: false }).variant, 'cpu')
})

test('resolveGguf from flags path', () => {
  const f = path.join(os.tmpdir(), `deep-gguf-${Date.now()}.gguf`)
  fs.writeFileSync(f, 'gguf')
  try {
    assert.equal(resolveGguf({ flagsGguf: f }), path.resolve(f))
  } finally {
    fs.unlinkSync(f)
  }
})

test('resolveGguf missing flags throws exitCode 2', () => {
  assert.throws(() => resolveGguf({ flagsGguf: path.join(os.tmpdir(), 'no-such-model.gguf') }), (e) => e.exitCode === 2)
})

test('llamaStatusFromRun levels', () => {
  assert.equal(llamaStatusFromRun(null).level, 'red')
  assert.equal(llamaStatusFromRun({ pids: {} }).level, 'red')
  assert.equal(llamaStatusFromRun({ pids: { llama: process.pid }, warming: true }).level, 'yellow')
  assert.equal(llamaStatusFromRun({ pids: { llama: process.pid }, warming: false, urls: { llama: 'http://x' } }).level, 'green')
})

test('stopLlama no-op', () => {
  stopLlama(null)
  stopLlama(0)
})
