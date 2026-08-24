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

test('listAvailableServers returns entries', () => {
  const list = listAvailableServers()
  assert.ok(list.some((s) => s.id === 'typescript'))
  assert.ok(list.some((s) => s.id === 'pyright'))
})

test('lspQuery missing file and missing server', async () => {
  const missing = await lspQuery({ op: 'hover', file: path.join(os.tmpdir(), `no-${Date.now()}.ts`) })
  assert.equal(missing.ok, false)
  assert.match(missing.error, /not found/)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-lsp-'))
  const f = path.join(tmp, 'x.md')
  fs.writeFileSync(f, '# hi\n')
  const r = await lspQuery({ op: 'hover', file: f })
  assert.equal(r.ok, false)
  fs.rmSync(tmp, { recursive: true, force: true })
})
