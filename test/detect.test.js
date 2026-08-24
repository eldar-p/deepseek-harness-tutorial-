import test from 'node:test'
import assert from 'node:assert/strict'
import { nodeOk, detectOsFamily, isRoot } from '../src/detect.js'

test('nodeOk on current runtime', () => {
  assert.equal(nodeOk(), Number(process.versions.node.split('.')[0]) >= 22)
})

test('detectOsFamily returns string', () => {
  const f = detectOsFamily()
  assert.ok(['windows', 'mac', 'linux', 'debian', 'fedora'].includes(f))
})

test('isRoot false on win32', () => {
  if (process.platform === 'win32') assert.equal(isRoot(), false)
})
