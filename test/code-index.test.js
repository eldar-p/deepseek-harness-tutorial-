import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chunkSource, langForPath, listSourceFiles } from '../src/code-index/chunker.js'
import { hashEmbed, cosine, arrayToVec } from '../src/code-index/embedder.js'
import { indexPaths, loadJsonStore, saveJsonStore, searchJson } from '../src/code-index/store.js'
import { buildIndex, searchIndex, indexStatus, defaultIndexDir, indexFile } from '../src/code-index/indexer.js'
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
