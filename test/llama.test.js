import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import {
  resolveGguf,
  pickBinaryEntry,
  hostThreads,
  llamaStatusFromRun,
  stopLlama,
  ensureLlamaBinary,
  maybeDownloadDefaultGguf,
} from '../src/llama.js'
import { paths } from '../src/paths.js'

test('hostThreads in range', () => {
  const n = hostThreads()
  assert.ok(n >= 2 && n <= 8)
})

test('pickBinaryEntry prefers cuda when requested', () => {
  const plat = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const man = {
    binaries: [
      { os: plat, arch, variant: 'cpu', url: 'u1', sha256: 'a' },
      { os: plat, arch, variant: 'cuda', url: 'u2', sha256: 'b' },
    ],
  }
  assert.equal(pickBinaryEntry(man, { preferCuda: true }).variant, 'cuda')
  assert.equal(pickBinaryEntry(man, { preferCuda: false }).variant, 'cpu')
  assert.equal(pickBinaryEntry({ binaries: [] }, { preferCuda: true }), null)
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

test('resolveGguf from configGguf', () => {
  const f = path.join(os.tmpdir(), `deep-cfg-gguf-${Date.now()}.gguf`)
  fs.writeFileSync(f, 'x')
  try {
    assert.equal(resolveGguf({ configGguf: f }), f)
  } finally {
    fs.unlinkSync(f)
  }
})

test('llamaStatusFromRun levels', () => {
  assert.equal(llamaStatusFromRun(null).level, 'red')
  assert.equal(llamaStatusFromRun({ pids: {} }).level, 'red')
  assert.equal(llamaStatusFromRun({ pids: { llama: process.pid }, warming: true }).level, 'yellow')
  assert.equal(
    llamaStatusFromRun({ pids: { llama: process.pid }, warming: false, urls: { llama: 'http://x' } }).level,
    'green',
  )
})

test('stopLlama no-op', () => {
  stopLlama(null)
  stopLlama(0)
})

test('ensureLlamaBinary finds something without fetch when present', async () => {
  const r = await ensureLlamaBinary({ device: 'cpu', fetch: false }).catch((e) => e)
  if (r instanceof Error) {
    assert.match(r.message, /llama-server not found/)
  } else {
    assert.ok(r.bin)
    assert.ok(['path', 'runtime', 'env'].includes(r.source))
  }
})

test('maybeDownloadDefaultGguf uses cache hit', async () => {
  const models = paths().models
  fs.mkdirSync(models, { recursive: true })
  const name = `utest-cache-${process.pid}.gguf`
  const dest = path.join(models, name)
  const body = Buffer.from('fake-gguf')
  fs.writeFileSync(dest, body)
  const sha = createHash('sha256').update(body).digest('hex')
  try {
    const got = await maybeDownloadDefaultGguf({
      filename: name,
      name: 'utest',
      url: 'https://example.invalid/never.gguf',
      sha256: sha,
    })
    assert.equal(got, dest)
  } finally {
    try {
      fs.unlinkSync(dest)
    } catch {
      /* */
    }
  }
})
