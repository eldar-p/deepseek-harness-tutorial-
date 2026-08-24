import test from 'node:test'
import assert from 'node:assert/strict'
import { readLocalVersion, getChannelRevision, pickCliArtifact, cmdUpdate } from '../src/update.js'

test('readLocalVersion matches package', () => {
  const v = readLocalVersion()
  assert.match(v, /prealpha|alpha|beta|prebeta|rc/)
})

test('getChannelRevision stable', () => {
  const r = getChannelRevision('stable')
  assert.ok(r)
})

test('pickCliArtifact beta has win32 url', () => {
  const a = pickCliArtifact('beta', { platform: 'win32', arch: 'x64' })
  assert.ok(a)
  assert.ok(a.url.includes('deep-cli-'))
  assert.match(a.sha256, /^[a-f0-9]{64}$/i)
})

test('pickCliArtifact stable empty without DEEP_CLI_ZIP', () => {
  const prev = process.env.DEEP_CLI_ZIP
  delete process.env.DEEP_CLI_ZIP
  try {
    assert.equal(pickCliArtifact('stable', { platform: 'win32', arch: 'x64' }), null)
  } finally {
    if (prev !== undefined) process.env.DEEP_CLI_ZIP = prev
  }
})

test('cmdUpdate dry-run beta', async () => {
  await cmdUpdate({ channel: 'beta', 'dry-run': true })
})

test('cmdUpdate unknown channel throws', async () => {
  await assert.rejects(() => cmdUpdate({ channel: 'nope' }), (e) => e.exitCode === 2)
})
