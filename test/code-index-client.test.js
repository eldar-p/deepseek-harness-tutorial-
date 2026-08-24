import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveIndexUrl } from '../src/code-index/client.js'
import { startCodeIndexServer } from '../src/code-index/server.js'

test('resolveIndexUrl prefers GIM_INDEX_URL', () => {
  const prev = process.env.GIM_INDEX_URL
  process.env.GIM_INDEX_URL = 'http://127.0.0.1:19999'
  try {
    assert.equal(resolveIndexUrl('default'), 'http://127.0.0.1:19999')
  } finally {
    if (prev === undefined) delete process.env.GIM_INDEX_URL
    else process.env.GIM_INDEX_URL = prev
  }
})

test('index HTTP client search roundtrip', async () => {
  const prevLance = process.env.GIM_INDEX_LANCE
  process.env.GIM_INDEX_LANCE = '0'
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-http-'))
  fs.writeFileSync(path.join(root, 'auth.js'), 'export function login(token) { return token }\n')
  const { buildIndex } = await import('../src/code-index/indexer.js')
  await buildIndex({ workspaceRoot: root, useTreeSitter: false, maxFiles: 10 })

  const srv = await startCodeIndexServer({ port: 0, workspaceRoot: root })
  const base = srv.url

  const prev = process.env.GIM_INDEX_URL
  process.env.GIM_INDEX_URL = base
  try {
    const { indexHttpSearch, indexHttpStatus } = await import('../src/code-index/client.js')
    const st = await indexHttpStatus(base)
    assert.ok(st.ok)
    assert.ok(st.chunkCount >= 1)
    const hits = await indexHttpSearch(base, 'login token', 5)
    assert.equal(hits.ok, true)
    assert.ok(hits.hits.length >= 1)

    const { tryIndexHttpSearch } = await import('../src/code-index/client.js')
    const via = await tryIndexHttpSearch('default', 'login token', 3)
    assert.ok(via)
    assert.ok(via.hits.length >= 1)
  } finally {
    if (prevLance === undefined) delete process.env.GIM_INDEX_LANCE
    else process.env.GIM_INDEX_LANCE = prevLance
    if (prev === undefined) delete process.env.GIM_INDEX_URL
    else process.env.GIM_INDEX_URL = prev
    await new Promise((resolve) => srv.server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
})
