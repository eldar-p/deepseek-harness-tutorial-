import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { rewriteWorkspacePath, JailEscapeError, isPathInsideRoot } from '../src/workspace-jail.js'

const ROOT = process.platform === 'win32' ? 'C:\\Users\\test\\.gim\\workspace' : '/home/test/.gim/workspace'

test('rewriteWorkspacePath maps /workspace', () => {
  const out = rewriteWorkspacePath('/workspace/foo/bar.txt', ROOT)
  assert.equal(out, path.join(ROOT, 'foo', 'bar.txt'))
})

test('rewriteWorkspacePath maps bare /workspace', () => {
  assert.equal(rewriteWorkspacePath('/workspace', ROOT), path.resolve(ROOT))
})

test('rewriteWorkspacePath maps /tmp under workspace tmp', () => {
  const out = rewriteWorkspacePath('/tmp/x', ROOT)
  assert.equal(out, path.join(ROOT, 'tmp', 'x'))
})

test('rewriteWorkspacePath leaves unrelated paths', () => {
  assert.equal(rewriteWorkspacePath('/etc/passwd', ROOT), '/etc/passwd')
})

test('rewriteWorkspacePath keeps paths already under root', () => {
  const inner = path.join(ROOT, 'ok.txt')
  assert.equal(rewriteWorkspacePath(inner, ROOT), path.resolve(inner))
})

test('rewriteWorkspacePath rejects .. escape via /workspace', () => {
  assert.throws(
    () => rewriteWorkspacePath('/workspace/../outside.txt', ROOT),
    (e) => e instanceof JailEscapeError,
  )
})

test('rewriteWorkspacePath rejects gim .. escape', () => {
  assert.throws(
    () => rewriteWorkspacePath('/workspace/a/b/../../../../etc/passwd', ROOT),
    (e) => e instanceof JailEscapeError,
  )
})

test('isPathInsideRoot rejects sibling prefix trick', () => {
  const root = process.platform === 'win32' ? 'C:\\Users\\test\\.gim\\workspace' : '/tmp/gim-ws'
  const evil = root + '-evil' + path.sep + 'x'
  assert.equal(isPathInsideRoot(evil, root), false)
})

test('rewriteWorkspacePath rejects symlink escape when possible', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-jail-'))
  const outside = path.join(tmp, 'outside.txt')
  const root = path.join(tmp, 'ws')
  fs.mkdirSync(root)
  fs.writeFileSync(outside, 'secret')
  const link = path.join(root, 'leak')
  try {
    fs.symlinkSync(outside, link)
  } catch (e) {
    // Windows without Developer Mode / privileges
    fs.rmSync(tmp, { recursive: true, force: true })
    if (process.platform === 'win32') {
      console.log('skip symlink test:', e.message)
      return
    }
    throw e
  }
  assert.throws(
    () => rewriteWorkspacePath('/workspace/leak', root),
    (e) => e instanceof JailEscapeError,
  )
  fs.rmSync(tmp, { recursive: true, force: true })
})
