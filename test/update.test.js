import test from 'node:test'
import assert from 'node:assert/strict'
import { readLocalVersion, getChannelRevision } from '../src/update.js'

test('readLocalVersion matches package', () => {
  const v = readLocalVersion()
  assert.match(v, /prealpha|alpha|beta/)
})

test('getChannelRevision stable', () => {
  const r = getChannelRevision('stable')
  assert.ok(r)
})
