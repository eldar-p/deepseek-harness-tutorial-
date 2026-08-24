import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { rewriteWorkspacePath } from '../src/workspace-jail.js'

const ROOT = process.platform === 'win32' ? 'C:\\Users\\test\\.deep\\workspace' : '/home/test/.deep/workspace'

test('rewriteWorkspacePath maps /workspace', () => {
  const out = rewriteWorkspacePath('/workspace/foo/bar.txt', ROOT)
  assert.equal(out, path.join(ROOT, 'foo', 'bar.txt'))
})

test('rewriteWorkspacePath maps bare /workspace', () => {
  assert.equal(rewriteWorkspacePath('/workspace', ROOT), ROOT)
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
