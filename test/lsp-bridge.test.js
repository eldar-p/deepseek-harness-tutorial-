import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pickServerForFile, listAvailableServers, lspQuery } from '../src/lsp-bridge.js'

test('pickServerForFile maps js and unknown', () => {
  const js = pickServerForFile('src/app.ts')
  assert.equal(js.id, 'typescript')
  const unk = pickServerForFile('notes.md')
  assert.equal(unk.id, null)
  assert.match(unk.reason, /no LSP mapping/)
})

test('lspQuery workspace_symbols without file when no server', async () => {
  const r = await lspQuery({ op: 'workspace_symbols', query: 'foo', workspace: os.tmpdir() })
  // Either ok with results, or fail missing server — must not throw
  assert.ok('ok' in r)
  if (!r.ok) assert.match(r.error || '', /PATH|not installed|timeout|server/i)
})

test('listAvailableServers returns entries', () => {
  const list = listAvailableServers()
  assert.ok(list.some((s) => s.id === 'typescript'))
  assert.ok(list.some((s) => s.id === 'pyright'))
})

test('lspQuery missing file and missing server', async () => {
  const missing = await lspQuery({ op: 'hover', file: path.join(os.tmpdir(), `no-${Date.now()}.ts`) })
  assert.equal(missing.ok, false)
  assert.match(missing.error, /not found/)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-lsp-'))
  const f = path.join(tmp, 'x.md')
  fs.writeFileSync(f, '# hi\n')
  const r = await lspQuery({ op: 'hover', file: f })
  assert.equal(r.ok, false)
  fs.rmSync(tmp, { recursive: true, force: true })
})
