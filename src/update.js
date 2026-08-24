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
 * Pre-alpha update: sync channel in config, compare revisions, hint git/CDN path.
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
  const artifacts = cliRel?.artifacts?.length || 0

  console.log('Deep update (pre-alpha)')
  console.log(`  channel    ${channel}`)
  console.log(`  revision   ${revision || '?'}`)
  console.log(`  cli local  ${localVer}`)
  console.log(`  cli CDN    ${cliRel?.version || 'n/a'} (${artifacts} artifacts)`)

  if (artifacts === 0) {
    console.log('')
    console.log('[INFO] CDN not wired — update via git:')
    console.log('       git pull && npm link')
    console.log('       or re-run scripts/install-deep.ps1|sh')
    console.log('[INFO] Manifest cache: ~/.deep/manifests-cache (delete to re-fetch)')
    appendLog(`event=update channel=${channel} mode=git-hint`)
    return
  }

  console.log('[WARN] CDN artifacts listed but downloader not implemented yet (beta)')
  appendLog(`event=update channel=${channel} mode=cdn-stub`)
}
