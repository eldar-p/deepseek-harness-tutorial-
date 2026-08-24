import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import {
  isPidAlive,
  findFileRecursive,
  runLogPath,
  killTree,
  waitHttpOk,
  extractArchive,
  spawnDetached,
} from '../src/proc.js'

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

test('waitHttpOk succeeds against local server', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200)
    res.end('ok')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()
  try {
    assert.equal(await waitHttpOk(`http://127.0.0.1:${port}/`, { timeoutMs: 5_000, intervalMs: 100 }), true)
  } finally {
    server.close()
  }
})

test('waitHttpOk times out', async () => {
  await assert.rejects(
    () => waitHttpOk('http://127.0.0.1:1/', { timeoutMs: 300, intervalMs: 50, label: 'utest' }),
    /utest not ready/,
  )
})

test('extractArchive expands zip on win32', () => {
  if (process.platform !== 'win32') return
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-zip-'))
  const src = path.join(dir, 'payload.txt')
  const zip = path.join(dir, 'a.zip')
  const dest = path.join(dir, 'out')
  fs.writeFileSync(src, 'hello-archive')
  const ps = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Compress-Archive -LiteralPath '${src}' -DestinationPath '${zip}' -Force`],
    { encoding: 'utf8' },
  )
  assert.equal(ps.status, 0, ps.stderr || ps.stdout)
  extractArchive(zip, dest)
  assert.ok(fs.existsSync(path.join(dest, 'payload.txt')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('spawnDetached starts and can be killed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-spawn-'))
  const logFile = path.join(dir, 'out.log')
  const bin = process.execPath
  const pid = spawnDetached(bin, ['-e', 'setInterval(()=>{},1000)'], { cwd: dir, logFile })
  assert.ok(pid > 0)
  assert.equal(isPidAlive(pid), true)
  killTree(pid, { force: true })
  await new Promise((r) => setTimeout(r, 200))
  fs.rmSync(dir, { recursive: true, force: true })
})
