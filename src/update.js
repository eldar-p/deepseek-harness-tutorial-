import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, appendLog } from './paths.js'
import { loadManifest } from './download.js'
import { readConfig, writeConfig, getOrInitConfig } from './config.js'
import { resolveArtifactSource, installFromZip } from './cli-install.js'

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
 * Prefers entries with a real url; falls back to DEEP_CLI_ZIP local override.
 * @param {string} channel
 * @param {{ platform?: string, arch?: string }} [opts]
 * @returns {object|null}
 */
export function pickCliArtifact(channel, { platform = process.platform, arch = process.arch } = {}) {
  if (process.env.DEEP_CLI_ZIP && fs.existsSync(process.env.DEEP_CLI_ZIP)) {
    return {
      os: platform,
      arch,
      format: 'zip',
      url: process.env.DEEP_CLI_ZIP,
      sha256: process.env.DEEP_CLI_SHA256 || null,
      version: getCliReleaseInfo(channel)?.version || readLocalVersion(),
    }
  }
  const info = getCliReleaseInfo(channel)
  const arts = info?.artifacts
  if (!Array.isArray(arts) || arts.length === 0) return null
  const os = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux'
  const a = arch === 'arm64' ? 'arm64' : 'x64'
  const hit = arts.find((x) => x.os === os && x.arch === a && x.url)
  if (!hit) return null
  return { ...hit, version: info.version || readLocalVersion() }
}

/**
 * Update: sync channel; download/verify CDN (or local) zip; extract + shim.
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
  const artifacts = cliRel?.artifacts?.filter((a) => a.url)?.length || 0

  console.log('Deep update')
  console.log(`  channel    ${channel}`)
  console.log(`  revision   ${revision || '?'}`)
  console.log(`  cli local  ${localVer}`)
  console.log(`  cli CDN    ${cliRel?.version || 'n/a'} (${artifacts} artifacts with url)`)
  console.log(`  license    CC-BY-NC-SA-4.0`)

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
    console.log('[INFO] Local zip test: set DEEP_CLI_ZIP=path\\to\\deep-cli-*.zip')
    console.log('[INFO] Manifest cache: ~/.deep/manifests-cache')
    appendLog(`event=update channel=${channel} mode=git-hint`)
    return
  }

  const src = resolveArtifactSource(artifact.url)
  if (!src) throw Object.assign(new Error(`bad artifact url: ${artifact.url}`), { exitCode: 2 })

  let zipPath
  if (src.kind === 'file') {
    if (!fs.existsSync(src.path)) throw Object.assign(new Error(`zip not found: ${src.path}`), { exitCode: 2 })
    zipPath = src.path
    console.log(`[INFO] Using local zip ${zipPath}`)
  } else {
    const { downloadFile } = await import('./download.js')
    zipPath = path.join(
      paths().manifestsCache,
      'cli-update',
      path.basename(new URL(src.url).pathname) || 'cli-artifact.zip',
    )
    console.log(`[INFO] Fetching ${src.url}`)
    await downloadFile(src.url, zipPath, {
      expectedSha256: artifact.sha256 || null,
      label: 'cli-cdn',
    })
    console.log(`[OK] Cached ${zipPath}`)
  }

  if (artifact.sha256 && src.kind === 'file') {
    const { sha256File } = await import('./download.js')
    const got = sha256File(zipPath)
    if (got !== artifact.sha256.toLowerCase()) {
      throw Object.assign(new Error(`sha256 mismatch: got ${got}, want ${artifact.sha256}`), { exitCode: 1 })
    }
    console.log('[OK] sha256 verified')
  }

  const version = artifact.version || cliRel?.version || localVer
  const installed = installFromZip(zipPath, version)
  console.log(`[OK] Installed ${version}`)
  console.log(`     root  ${installed.installRoot}`)
  console.log(`     shim  ${installed.shim}`)
  console.log(`[INFO] Add to PATH if needed: ${installed.binDir}`)
  console.log('[INFO] License: CC BY-NC-SA 4.0 — non-commercial use; see LICENSE')
  appendLog(`event=update channel=${channel} mode=cdn-install version=${version}`)
}

export { resolveArtifactSource, installFromZip }
