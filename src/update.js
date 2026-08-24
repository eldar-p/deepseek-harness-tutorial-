import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, appendLog } from './paths.js'
import { loadManifest } from './download.js'
import { readConfig, writeConfig, getOrInitConfig } from './config.js'

const CHANNELS = ['stable', 'beta', 'edge']

export function readLocalVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
  return pkg.version
}

export function getChannelRevision(channel) {
  const ch = loadManifest('channels.json')
  return ch.revisions?.[channel] || null
}

export function getCliReleaseInfo(channel) {
  try {
    const rel = loadManifest('cli-releases.json')
    return rel.channels?.[channel]?.cli || null
  } catch {
    return null
  }
}

/**
 * Select CDN artifact for this host from cli-releases.json.
 * @returns {{ url: string, sha256: string|null, format: string, os: string, arch: string }|null}
 */
export function pickCliArtifact(channel, { platform = process.platform, arch = process.arch } = {}) {
  const info = getCliReleaseInfo(channel)
  const arts = info?.artifacts
  if (!Array.isArray(arts) || arts.length === 0) return null
  const os = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux'
  const a = arch === 'arm64' ? 'arm64' : 'x64'
  return arts.find((x) => x.os === os && x.arch === a && x.url) || null
}

/**
 * Update: sync channel, compare revisions; if CDN artifact present — download+verify.
 */
export async function cmdUpdate(flags) {
  const channel = flags.channel || readConfig()?.channel || 'stable'
  if (!CHANNELS.includes(channel)) {
    throw Object.assign(new Error(`Unknown channel: ${channel} (use stable|beta|edge)`), { exitCode: 2 })
  }

  const cfg = getOrInitConfig({ channel })
  cfg.channel = channel
  writeConfig(cfg)

  const localVer = readLocalVersion()
  const revision = getChannelRevision(channel)
  const cliRel = getCliReleaseInfo(channel)
  const artifact = pickCliArtifact(channel)
  const artifacts = cliRel?.artifacts?.length || 0

  console.log('Deep update')
  console.log(`  channel    ${channel}`)
  console.log(`  revision   ${revision || '?'}`)
  console.log(`  cli local  ${localVer}`)
  console.log(`  cli CDN    ${cliRel?.version || 'n/a'} (${artifacts} artifacts)`)

  if (flags['dry-run']) {
    if (artifact) console.log(`  would get  ${artifact.url}`)
    else console.log('  would get  (git pull — no CDN artifact for this OS)')
    appendLog(`event=update channel=${channel} mode=dry-run`)
    return
  }

  if (!artifact) {
    console.log('')
    console.log('[INFO] CDN not wired for this OS — update via git:')
    console.log('       git pull && npm link')
    console.log('       or re-run scripts/install-deep.ps1|sh')
    console.log('[INFO] Manifest cache: ~/.deep/manifests-cache (delete to re-fetch)')
    appendLog(`event=update channel=${channel} mode=git-hint`)
    return
  }

  const { downloadFile } = await import('./download.js')
  const dest = path.join(
    paths().manifestsCache,
    'cli-update',
    path.basename(new URL(artifact.url).pathname) || 'cli-artifact',
  )
  console.log(`[INFO] Fetching ${artifact.url}`)
  await downloadFile(artifact.url, dest, {
    expectedSha256: artifact.sha256 || null,
    label: 'cli-cdn',
  })
  console.log(`[OK] Cached ${dest}`)
  console.log('[INFO] Extract/install from CDN zip not automated yet — use archive manually or git')
  appendLog(`event=update channel=${channel} mode=cdn-fetch dest=${dest}`)
}
