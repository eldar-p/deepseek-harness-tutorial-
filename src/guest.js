import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, engineEnv } from './detect.js'
import { paths, PKG_ROOT, appendLog } from './paths.js'
import { loadManifest } from './download.js'

function containerName(stack) {
  return `deep-guest-${stack}`
}

/** Windows host path → Docker Desktop mount form when needed. */
export function toContainerHostPath(hostPath) {
  if (process.platform !== 'win32') return hostPath
  // Docker Desktop accepts F:\foo or //f/foo — prefer forward slashes
  const resolved = path.resolve(hostPath)
  return resolved.replace(/\\/g, '/')
}

export function guestNetworkArgs(presetNet, allowlistDomains = []) {
  // Pre-alpha: offline → --network none; others → bridge (allowlist enforcement later via proxy)
  if (presetNet === 'none' || presetNet === 'offline') return ['--network', 'none']
  return ['--network', 'bridge']
}

export async function ensureGuestImage() {
  const engine = detectContainerEngine()
  if (!engine.ok || !engine.bin) return { ok: false, reason: engine.detail || engine.reason || 'no engine' }

  const man = loadManifest('guest-images.json')
  const image = man.image || 'deep-guest:prealpha'
  const check = spawnSync(engine.bin, ['image', 'inspect', image], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engine.bin),
  })
  if (check.status === 0) return { ok: true, image, engine }

  const dockerfile = path.join(PKG_ROOT, 'Dockerfile.guest')
  if (!fs.existsSync(dockerfile)) {
    return { ok: false, reason: `image ${image} missing and no Dockerfile.guest` }
  }
  console.log(`[INFO] Building guest image ${image}…`)
  const build = spawnSync(engine.bin, ['build', '-t', image, '-f', dockerfile, PKG_ROOT], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    env: engineEnv(engine.bin),
  })
  if (build.status !== 0) {
    return { ok: false, reason: (build.stderr || build.stdout || 'build failed').slice(0, 200) }
  }
  appendLog(`event=guest_image_built image=${image}`)
  return { ok: true, image, engine }
}

export async function startGuest({ stack, presetNet = 'allowlist' }) {
  const ensured = await ensureGuestImage()
  if (!ensured.ok) {
    return { ok: false, detail: ensured.reason }
  }
  const { engine, image } = ensured
  const name = containerName(stack)
  const ws = paths(stack).workspace
  const mount = `${toContainerHostPath(ws)}:/workspace`

  spawnSync(engine.bin, ['rm', '-f', name], { encoding: 'utf8', windowsHide: true, env: engineEnv(engine.bin) })

  const allow = loadManifest('allowlists.json')
  const domains = allow[presetNet] || allow.balanced || []
  const args = [
    'run',
    '-d',
    '--name',
    name,
    '--hostname',
    'sandbox',
    ...guestNetworkArgs(presetNet, domains),
    '-v',
    mount,
    '-w',
    '/workspace',
    image,
    'sleep',
    'infinity',
  ]
  const r = spawnSync(engine.bin, args, { encoding: 'utf8', windowsHide: true, env: engineEnv(engine.bin) })
  if (r.status !== 0) {
    return { ok: false, detail: (r.stderr || r.stdout || 'run failed').slice(0, 200) }
  }
  appendLog(`event=guest_start name=${name}`)
  return { ok: true, name, engine: engine.bin }
}

export async function mountSmoke(stack, engineBin) {
  const name = containerName(stack)
  const marker = `.deep-smoke-${Date.now()}`
  const touch = spawnSync(engineBin, ['exec', name, 'sh', '-c', `touch /workspace/${marker} && ls /workspace/${marker}`], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engineBin),
  })
  if (touch.status !== 0) {
    return { ok: false, detail: (touch.stderr || 'smoke failed').slice(0, 120) }
  }
  spawnSync(engineBin, ['exec', name, 'rm', '-f', `/workspace/${marker}`], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engineBin),
  })
  // also remove on host if leftover
  const hostMarker = path.join(paths(stack).workspace, marker)
  if (fs.existsSync(hostMarker)) fs.unlinkSync(hostMarker)
  return { ok: true }
}

export function stopGuest(stack, engineBin) {
  const name = containerName(stack)
  const bin = engineBin || detectContainerEngine().bin
  if (!bin) return
  spawnSync(bin, ['rm', '-f', name], { encoding: 'utf8', windowsHide: true, env: engineEnv(bin) })
  appendLog(`event=guest_stop name=${name}`)
}

export function isGuestRunning(stack) {
  const engine = detectContainerEngine()
  if (!engine.ok) return false
  const name = containerName(stack)
  const r = spawnSync(engine.bin, ['inspect', '-f', '{{.State.Running}}', name], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engine.bin),
  })
  return r.status === 0 && String(r.stdout).trim() === 'true'
}
