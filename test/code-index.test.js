import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chunkSource, langForPath, listSourceFiles } from '../src/code-index/chunker.js'
import { hashEmbed, cosine, arrayToVec } from '../src/code-index/embedder.js'
import { indexPaths, loadJsonStore, loadIndexMeta, loadJsonChunks, loadFileMap, saveJsonStore, searchJson, searchJsonAsync, loadAllChunks, lanceEnabled } from '../src/code-index/store.js'
import { buildIndex, searchIndex, indexStatus, defaultIndexDir, indexFile, fileContentHash } from '../src/code-index/indexer.js'
import { scheduleIndexTouch, flushIndexTouchForTests } from '../src/code-index/touch.js'
import { writeWorkspaceFile } from '../src/agent-tools.js'
import { cmdIndexBuild, cmdIndexSearch, cmdIndexStatus } from '../src/code-index-cli.js'
import { secretHeadersForHost, readSecrets, ensureSecretsTemplate } from '../src/secrets.js'

test('langForPath detects js', () => {
  assert.equal(langForPath('src/foo.ts'), 'js')
  assert.equal(langForPath('main.py'), 'py')
})

test('chunkSource extracts JS function', () => {
  const src = `export function add(a, b) {
  return a + b
}
`
  const chunks = chunkSource('math.js', src)
  assert.ok(chunks.some((c) => c.symbol === 'add' && c.kind === 'function'))
})

test('hashEmbed similar texts score higher', () => {
  const a = hashEmbed('function authenticate user token jwt')
  const b = hashEmbed('authenticate jwt token validation')
  const c = hashEmbed('completely unrelated database schema migration')
  assert.ok(cosine(a, b) > cosine(a, c))
})

test('secretHeadersForHost matches domain', () => {
  const secrets = { 'github.com': { Authorization: 'Bearer x' } }
  assert.equal(secretHeadersForHost('api.github.com', secrets).Authorization, 'Bearer x')
  assert.deepEqual(secretHeadersForHost('example.com', secrets), {})
})

test('readSecrets skips underscore keys and bad json', () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-sec-'))
  process.env.GIM_HOME = home
  try {
    assert.deepEqual(readSecrets(), {})
    fs.writeFileSync(
      path.join(home, 'secrets.json'),
      JSON.stringify({ _comment: 'x', 'api.example.com': { Authorization: 't' } }),
    )
    const s = readSecrets()
    assert.equal(s['api.example.com'].Authorization, 't')
    assert.equal(s._comment, undefined)
    fs.writeFileSync(path.join(home, 'secrets.json'), '{not-json')
    assert.deepEqual(readSecrets(), {})
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('ensureSecretsTemplate writes sample once', () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-sec-tpl-'))
  process.env.GIM_HOME = home
  try {
    ensureSecretsTemplate()
    const tpl = path.join(home, 'secrets.template.json')
    assert.ok(fs.existsSync(tpl))
    ensureSecretsTemplate()
    assert.ok(fs.existsSync(tpl))
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('lanceEnabled respects GIM_INDEX_LANCE=0', () => {
  const prev = process.env.GIM_INDEX_LANCE
  process.env.GIM_INDEX_LANCE = '0'
  assert.equal(lanceEnabled(), false)
  if (prev === undefined) delete process.env.GIM_INDEX_LANCE
  else process.env.GIM_INDEX_LANCE = prev
})

test('sharded store per-file shards + loadAllChunks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-shard-'))
  const vec = Array.from(hashEmbed('shard test auth'))
  const fileMap = { 'a.js': { hash: 'abc', mtime: 1 } }
  saveJsonStore(
    dir,
    [
      {
        id: 'a.js:1:hi',
        path: 'a.js',
        symbol: 'hi',
        kind: 'function',
        startLine: 1,
        endLine: 2,
        text: 'function hi() {}',
        lang: 'js',
        vector: vec,
        mtime: 1,
      },
    ],
    { backend: 'json', fileCount: 1, fileMap, sharded: true },
  )
  const meta = loadIndexMeta(dir)
  assert.equal(meta.sharded, true)
  assert.ok(fs.existsSync(path.join(indexPaths(dir).shards, 'a.js.json')))
  const loaded = loadAllChunks(dir)
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].symbol, 'hi')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('indexFile uses shard fast path', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-shard-touch-'))
  fs.writeFileSync(path.join(root, 'a.js'), 'export function a() {}\n')
  const indexDir = defaultIndexDir(root)
  await buildIndex({ workspaceRoot: root, indexDir, useTreeSitter: false, maxFiles: 10 })
  const meta = loadIndexMeta(indexDir)
  assert.equal(meta.sharded, true)
  fs.writeFileSync(path.join(root, 'a.js'), 'export function aChanged() {}\n')
  const r = await indexFile(root, 'a.js', null)
  assert.equal(r.ok, true)
  assert.equal(r.sharded, true)
  const chunks = loadAllChunks(indexDir)
  assert.ok(chunks.some((c) => c.symbol === 'aChanged'))
  fs.rmSync(root, { recursive: true, force: true })
})

test('indexFile sharded marks chunksStale and snapshot clears it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-snap-'))
  fs.writeFileSync(path.join(root, 'a.js'), 'export function a() {}\n')
  const indexDir = defaultIndexDir(root)
  await buildIndex({ workspaceRoot: root, indexDir, useTreeSitter: false, maxFiles: 10 })
  fs.writeFileSync(path.join(root, 'a.js'), 'export function aSnap() {}\n')
  const r = await indexFile(root, 'a.js', null)
  assert.equal(r.sharded, true)
  const meta = loadIndexMeta(indexDir)
  assert.equal(meta.chunksStale, true)
  const { flushChunksSnapshot } = await import('../src/code-index/store.js')
  const snap = flushChunksSnapshot(indexDir)
  assert.equal(snap.ok, true)
  assert.equal(loadIndexMeta(indexDir).chunksStale, false)
  const raw = JSON.parse(fs.readFileSync(indexPaths(indexDir).json, 'utf8'))
  assert.ok(raw.chunks.some((c) => c.symbol === 'aSnap'))
  fs.rmSync(root, { recursive: true, force: true })
})

test('json store save load search', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-'))
  const vec = Array.from(hashEmbed('hello world auth'))
  saveJsonStore(
    dir,
    [
      {
        id: 'a.js:1:hi',
        path: 'a.js',
        symbol: 'hi',
        kind: 'function',
        startLine: 1,
        endLine: 2,
        text: 'function hi() {}',
        lang: 'js',
        vector: vec,
        mtime: 1,
      },
    ],
    { backend: 'json', fileCount: 1 },
  )
  const loaded = loadJsonStore(dir)
  assert.equal(loaded.chunks.length, 1)
  assert.equal(loaded.backend, 'json')
  assert.ok(loaded.builtAt)
  const hits = searchJson(loaded.chunks, arrayToVec(vec), 3)
  assert.ok(hits.length >= 1)
  assert.equal(indexPaths(dir).json.endsWith('chunks.json'), true)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('buildIndex and searchIndex roundtrip', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ws-'))
  fs.writeFileSync(
    path.join(root, 'auth.js'),
    `export function login(user, token) {\n  return token\n}\n`,
  )
  fs.writeFileSync(path.join(root, 'readme.txt'), 'ignore me')
  const indexDir = defaultIndexDir(root)
  const built = await buildIndex({
    workspaceRoot: root,
    indexDir,
    useTreeSitter: false,
    maxFiles: 20,
    onProgress: () => {},
  })
  assert.equal(built.ok, true)
  assert.ok(built.chunkCount >= 1)
  const st = indexStatus(indexDir)
  assert.ok(st.chunkCount >= 1)
  const r = await searchIndex({
    workspaceRoot: root,
    indexDir,
    query: 'login token auth',
    limit: 5,
  })
  assert.equal(r.ok, true)
  assert.ok(r.hits.length >= 1)
  await indexFile(root, 'auth.js', null)
  const files = listSourceFiles(root, { maxFiles: 50 })
  assert.ok(files.some((f) => f.endsWith('auth.js')))
  fs.rmSync(root, { recursive: true, force: true })
})

test('incremental build skips unchanged files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-inc-'))
  fs.writeFileSync(path.join(root, 'a.js'), 'export function a() {}\n')
  fs.writeFileSync(path.join(root, 'b.js'), 'export function b() {}\n')
  const indexDir = defaultIndexDir(root)
  const first = await buildIndex({ workspaceRoot: root, indexDir, useTreeSitter: false, maxFiles: 20 })
  assert.equal(first.indexedFiles, 2)
  assert.equal(first.skippedFiles, 0)
  const second = await buildIndex({ workspaceRoot: root, indexDir, useTreeSitter: false, maxFiles: 20 })
  assert.equal(second.skippedFiles, 2)
  assert.equal(second.indexedFiles, 0)
  assert.equal(second.chunkCount, first.chunkCount)
  fs.writeFileSync(path.join(root, 'b.js'), 'export function bChanged() {}\n')
  const third = await buildIndex({ workspaceRoot: root, indexDir, useTreeSitter: false, maxFiles: 20 })
  assert.equal(third.skippedFiles, 1)
  assert.equal(third.indexedFiles, 1)
  assert.ok(loadFileMap(indexDir)['b.js']?.hash)
  fs.rmSync(root, { recursive: true, force: true })
})

test('indexStatus reads meta only (lazy index)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-lazy-'))
  saveJsonStore(
    dir,
    [{ id: 'x:1:y', path: 'x.js', symbol: 'y', kind: 'function', startLine: 1, endLine: 2, text: 'fn', lang: 'js', vector: [1], mtime: 1 }],
    { backend: 'json', fileCount: 1 },
  )
  const st = indexStatus(dir)
  assert.equal(st.chunkCount, 1)
  assert.equal(st.backend, 'json')
  fs.unlinkSync(indexPaths(dir).json)
  const st2 = indexStatus(dir)
  assert.equal(st2.chunkCount, 1)
  assert.equal(loadJsonChunks(dir).length, 0)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('fileContentHash stable', () => {
  assert.equal(fileContentHash('hello'), fileContentHash('hello'))
  assert.notEqual(fileContentHash('hello'), fileContentHash('world'))
})

test('searchJsonAsync uses worker path for large indexes', async () => {
  const prev = process.env.GIM_INDEX_WORKER_MIN
  process.env.GIM_INDEX_WORKER_MIN = '10'
  try {
    const vec = Array.from(hashEmbed('worker batch cosine'))
    /** @type {import('../src/code-index/store.js').StoredChunk[]} */
    const chunks = []
    for (let i = 0; i < 12; i++) {
      chunks.push({
        id: `f.js:${i}:fn${i}`,
        path: 'f.js',
        symbol: `fn${i}`,
        kind: 'function',
        startLine: i,
        endLine: i + 1,
        text: `function fn${i}() {}`,
        lang: 'js',
        vector: vec,
        mtime: 1,
      })
    }
    const hits = await searchJsonAsync(chunks, arrayToVec(vec), 5)
    assert.ok(hits.length >= 1)
    assert.ok(hits[0].score > 0.5)
  } finally {
    if (prev === undefined) delete process.env.GIM_INDEX_WORKER_MIN
    else process.env.GIM_INDEX_WORKER_MIN = prev
  }
})

test('indexFile skips unchanged hash', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-touch-'))
  fs.writeFileSync(path.join(root, 'a.js'), 'export function a() {}\n')
  const indexDir = defaultIndexDir(root)
  await buildIndex({ workspaceRoot: root, indexDir, useTreeSitter: false, maxFiles: 10 })
  const r = await indexFile(root, 'a.js', null)
  assert.equal(r.skipped, true)
  assert.equal(r.reason, 'unchanged')
  fs.rmSync(root, { recursive: true, force: true })
})

test('indexFile skips when index not built', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-idx-nobuild-'))
  fs.writeFileSync(path.join(root, 'a.js'), 'export function a() {}\n')
  const r = await indexFile(root, 'a.js', null)
  assert.equal(r.skipped, true)
  assert.equal(r.reason, 'index not built')
  fs.rmSync(root, { recursive: true, force: true })
})

test('write_file schedules index touch when index exists', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-touch-'))
  process.env.GIM_HOME = home
  const stack = 'touch-stack'
  const ws = path.join(home, 'workspace', stack)
  fs.mkdirSync(ws, { recursive: true })
  fs.writeFileSync(path.join(ws, 'a.js'), 'export function a() {}\n')
  const indexDir = defaultIndexDir(ws)
  await buildIndex({ workspaceRoot: ws, indexDir, useTreeSitter: false, maxFiles: 10 })
  writeWorkspaceFile(stack, 'a.js', 'export function aChanged() {}\n')
  scheduleIndexTouch(stack, 'a.js')
  flushIndexTouchForTests()
  fs.rmSync(home, { recursive: true, force: true })
  if (prev === undefined) delete process.env.GIM_HOME
  else process.env.GIM_HOME = prev
})

test('cmdIndex CLI build search status', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-cli-idx-'))
  process.env.GIM_HOME = home
  const stack = 'utest-idx'
  const ws = path.join(home, 'workspace', stack)
  fs.mkdirSync(ws, { recursive: true })
  fs.writeFileSync(path.join(ws, 'math.js'), 'export function add(a,b){return a+b}\n')
  try {
    await cmdIndexBuild({ name: stack })
    await assert.rejects(() => cmdIndexSearch({ name: stack }, []), (e) => e.exitCode === 2)
    await cmdIndexSearch({ name: stack }, ['add', 'function'])
    await cmdIndexStatus({ name: stack })
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
