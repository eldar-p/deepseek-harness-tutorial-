import test from 'node:test'
import assert from 'node:assert/strict'
import { readLocalVersion, getChannelRevision, pickCliArtifact } from '../src/update.js'

test('readLocalVersion matches package', () => {
  const v = readLocalVersion()
  assert.match(v, /prealpha|alpha|beta/)
})

test('getChannelRevision stable', () => {
  const r = getChannelRevision('stable')
  assert.ok(r)
})

test('pickCliArtifact returns null when urls empty', () => {
  assert.equal(pickCliArtifact('stable'), null)
  // beta has placeholders with null url — still null
  assert.equal(pickCliArtifact('beta', { platform: 'win32', arch: 'x64' }), null)
})
