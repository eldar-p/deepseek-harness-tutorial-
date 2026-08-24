import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cmdLsp } from '../src/lsp-cli.js'

test('cmdLsp servers lists rows', async () => {
  await cmdLsp({}, ['servers'])
})

test('cmdLsp usage without args sets exitCode 2', async () => {
  const prev = process.exitCode
  process.exitCode = 0
  await cmdLsp({}, [])
  assert.equal(process.exitCode, 2)
  process.exitCode = prev
})

test('cmdLsp query missing file arg throws', async () => {
  await assert.rejects(() => cmdLsp({}, ['query', 'hover']), (e) => e.exitCode === 2)
})

test('cmdLsp hover missing file sets exit on not found', async () => {
  const prevHome = process.env.GIM_HOME
  const prevExit = process.exitCode
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-lsp-cli-'))
  process.env.GIM_HOME = home
  process.exitCode = 0
  try {
    fs.mkdirSync(path.join(home, 'workspace', 'default'), { recursive: true })
    await cmdLsp({ name: 'default' }, ['hover', 'no-such-file.md'])
    assert.equal(process.exitCode, 1)
  } finally {
    process.exitCode = prevExit
    if (prevHome === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prevHome
    fs.rmSync(home, { recursive: true, force: true })
  }
})
