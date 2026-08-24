import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, engineEnv } from './detect.js'
import { paths, PKG_ROOT, appendLog } from './paths.js'
import { loadManifest } from './download.js'

/** @param {string} stack */
function containerName(stack) {
  return `gim-guest-${stack}`
}

/** Windows host path → Docker Desktop mount form when needed.
 * @param {string} hostPath
 * @returns {string}
 */
export function toContainerHostPath(hostPath) {
  if (process.platform !== 'win32') return hostPath
  // Docker Desktop accepts F:\foo or //f/foo — prefer forward slashes
  const resolved = path.resolve(hostPath)
  return resolved.replace(/\\/g, '/')
}

/**
 * Resolve allowlist domains for a network preset.
 * @param {string} presetNet
 * @returns {string[]}
 */
export function resolveAllowlist(presetNet) {
  const allow = loadManifest('allowlists.json')
  if (presetNet === 'none' || presetNet === 'offline') return []
  if (presetNet === 'open') return ['*']
  if (presetNet === 'allowlist') return allow.balanced || allow.allowlist || []
  if (presetNet === 'dev') return allow.dev || allow.balanced || []
  return allow[presetNet] || allow.balanced || []
}

export function guestCapabilityArgs(presetNet) {
  if (presetNet === 'none' || presetNet === 'offline') return []
  // iptables in gim-net-enforce needs NET_ADMIN
  return ['--cap-add', 'NET_ADMIN']
}

export function guestNetworkArgs(presetNet, allowlistDomains = []) {
  void allowlistDomains
  if (presetNet === 'none' || presetNet === 'offline') return ['--network', 'none']
  if (presetNet === 'open') return ['--network', 'bridge']
  // allowlist + proxy sidecar share bridge; egress forced via HTTP_PROXY
  return ['--network', 'bridge']
}

/** Extra env when host egress proxy is active. */
export function guestProxyEnv(proxyPort) {
  if (!proxyPort) return {}
  const base =
    process.platform === 'win32' || process.platform === 'darwin'
      ? `http://host.docker.internal:${proxyPort}`
      : `http://172.17.0.1:${proxyPort}`
  return {
    HTTP_PROXY: base,
    HTTPS_PROXY: base,
    http_proxy: base,
    https_proxy: base,
    NO_PROXY: '127.0.0.1,localhost',
  }
}

/** Env vars passed into guest for network policy (iptables via gim-net-enforce). */
export function guestNetworkEnv(presetNet, allowlistDomains = []) {
  const domains = allowlistDomains.length ? allowlistDomains : resolveAllowlist(presetNet)
  return {
    GIM_NET_MODE: presetNet === 'allowlist' || presetNet === 'dev' ? 'allowlist' : presetNet,
    GIM_NET_ALLOWLIST: domains.join(','),
  }
}

export function formatAllowlistLog(presetNet, domains) {
  if (presetNet === 'none' || presetNet === 'offline') return 'network=none (no egress)'
  if (presetNet === 'open') return 'network=open (full egress — WARN)'
  const n = domains.length
  return `network=allowlist (${n} domain${n === 1 ? '' : 's'}; sidecar proxy + iptables)`
}

export async function ensureGuestImage() {
  const engine = detectContainerEngine()
  if (!engine.ok || !engine.bin) return { ok: false, reason: engine.detail || engine.reason || 'no engine' }

  const man = loadManifest('guest-images.json')
  const image = man.image || 'gim-guest:prealpha'
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
  const baseEnv = engineEnv(engine.bin)
  const attempts = [
    {
      args: ['build', '-t', image, '-f', dockerfile, PKG_ROOT],
      env: { ...baseEnv, DOCKER_BUILDKIT: process.env.DOCKER_BUILDKIT || '1' },
    },
    {
      args: ['buildx', 'build', '--load', '-t', image, '-f', dockerfile, PKG_ROOT],
      env: { ...baseEnv, DOCKER_BUILDKIT: '1' },
    },
    {
      args: ['build', '-t', image, '-f', dockerfile, PKG_ROOT],
      env: { ...baseEnv, DOCKER_BUILDKIT: '0' },
    },
  ]
  let build = null
  for (const attempt of attempts) {
    build = spawnSync(engine.bin, attempt.args, {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      env: attempt.env,
    })
    if (build.status === 0) break
  }
  if (build.status !== 0) {
    const detail = (build.stderr || build.stdout || 'build failed').slice(0, 240)
    return {
      ok: false,
      reason: `${detail} (hint: install docker-buildx-plugin, or build image on a host with BuildKit then reuse the same Docker engine)`,
    }
  }
  appendLog(`event=guest_image_built image=${image}`)
  return { ok: true, image, engine }
}

export async function startGuest({ stack, presetNet = 'allowlist', proxyPort = null }) {
  const ensured = await ensureGuestImage()
  if (!ensured.ok) {
    return { ok: false, detail: ensured.reason }
  }
  const { engine, image } = ensured
  const name = containerName(stack)
  const ws = paths(stack).workspace
  const mount = `${toContainerHostPath(ws)}:/workspace`

  spawnSync(engine.bin, ['rm', '-f', name], { encoding: 'utf8', windowsHide: true, env: engineEnv(engine.bin) })

  const resolved = resolveAllowlist(presetNet)
  const netEnv = guestNetworkEnv(presetNet, resolved)
  const proxyEnv =
    proxyPort && presetNet !== 'none' && presetNet !== 'offline' ? guestProxyEnv(proxyPort) : {}
  if (proxyPort && Object.keys(proxyEnv).length) {
    netEnv.GIM_NET_MODE = 'proxy'
    netEnv.GIM_PROXY_HOST = process.platform === 'win32' || process.platform === 'darwin' ? 'host.docker.internal' : '172.17.0.1'
    netEnv.GIM_PROXY_PORT = String(proxyPort)
  }
  console.log(`[INFO] Guest net: ${formatAllowlistLog(presetNet, resolved)}`)
  const envArgs = Object.entries({ ...netEnv, ...proxyEnv }).flatMap(([k, v]) => ['-e', `${k}=${v}`])
  const args = [
    'run',
    '-d',
    '--name',
    name,
    '--hostname',
    'sandbox',
    ...guestNetworkArgs(presetNet, resolved),
    ...guestCapabilityArgs(presetNet),
    ...envArgs,
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
  const marker = `.gim-smoke-${Date.now()}`
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
