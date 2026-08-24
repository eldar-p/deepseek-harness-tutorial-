import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cmdUpdate, pickCliArtifact, getCliReleaseInfo } from '../src/update.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function findLocalZip() {
  const dist = path.join(ROOT, 'dist')
  if (!fs.existsSync(dist)) return null
  const zips = fs.readdirSync(dist).filter((f) => f.startsWith('gim-cli-') && f.endsWith('.zip'))
  if (!zips.length) return null
  zips.sort()
  return path.join(dist, zips[zips.length - 1])
}

test('getCliReleaseInfo beta has version', () => {
  const info = getCliReleaseInfo('beta')
  assert.ok(info?.version)
})

test('pickCliArtifact respects GIM_CLI_ZIP', () => {
  const zip = findLocalZip()
  if (!zip) {
    assert.ok(true)
    return
  }
  const prev = process.env.GIM_CLI_ZIP
  const prevSha = process.env.GIM_CLI_SHA256
  process.env.GIM_CLI_ZIP = zip
  delete process.env.GIM_CLI_SHA256
  try {
    const a = pickCliArtifact('beta', { platform: 'win32', arch: 'x64' })
    assert.equal(a.url, zip)
  } finally {
    if (prev === undefined) delete process.env.GIM_CLI_ZIP
    else process.env.GIM_CLI_ZIP = prev
    if (prevSha === undefined) delete process.env.GIM_CLI_SHA256
    else process.env.GIM_CLI_SHA256 = prevSha
  }
})

test('cmdUpdate installs from local GIM_CLI_ZIP', async () => {
  const zip = findLocalZip()
  if (!zip) {
    assert.ok(true)
    return
  }
  const side = `${zip}.sha256`
  let sha = null
  if (fs.existsSync(side)) sha = fs.readFileSync(side, 'utf8').trim().split(/\s+/)[0]
  const prev = process.env.GIM_CLI_ZIP
  const prevSha = process.env.GIM_CLI_SHA256
  process.env.GIM_CLI_ZIP = zip
  if (sha) process.env.GIM_CLI_SHA256 = sha
  try {
    await cmdUpdate({ channel: 'beta' })
  } finally {
    if (prev === undefined) delete process.env.GIM_CLI_ZIP
    else process.env.GIM_CLI_ZIP = prev
    if (prevSha === undefined) delete process.env.GIM_CLI_SHA256
    else process.env.GIM_CLI_SHA256 = prevSha
  }
})

test('cmdUpdate stable dry-run with CDN pins', async () => {
  const prev = process.env.GIM_CLI_ZIP
  delete process.env.GIM_CLI_ZIP
  try {
    await cmdUpdate({ channel: 'stable', 'dry-run': true })
  } finally {
    if (prev !== undefined) process.env.GIM_CLI_ZIP = prev
  }
})
