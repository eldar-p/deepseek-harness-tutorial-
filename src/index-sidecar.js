/**
 * Code index sidecar — optional native gim-index binary or JS HTTP server (same contract).
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadManifest, ensureCachedAsset } from './download.js'
import { paths, PKG_ROOT } from './paths.js'
import { which } from './detect.js'
import { findFileRecursive, spawnDetached } from './proc.js'

export function indexSidecarExeName() {
  return process.platform === 'win32' ? 'gim-index.exe' : 'gim-index'
}

export function runtimeIndexSidecarRoot() {
  return path.join(paths().home, 'runtime', 'gim-index')
}

export function jsIndexSidecarScript() {
  return path.join(PKG_ROOT, 'scripts', 'gim-index-sidecar.mjs')
}

/** Cargo build output when developing from repo checkout. */
export function resolveLocalIndexSidecarBuild() {
  const exe = indexSidecarExeName()
  const candidates = [
    path.join(PKG_ROOT, 'sidecar', 'gim-index', 'target', 'release', exe),
    path.join(PKG_ROOT, 'sidecar', 'gim-index', 'target', 'debug', exe),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * @param {{ binaries?: object[] }} manifest
 */
export function pickIndexSidecarEntry(manifest) {
  const plat = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return (manifest.binaries || []).find((b) => b.os === plat && b.arch === arch) || null
}

/** @returns {{ bin: string, source: string, backend: 'native' } | null} */
export function resolveNativeIndexSidecarBin() {
  const mode = process.env.GIM_INDEX_SIDECAR
  if (mode === 'js' || mode === '0') return null

  if (mode && mode !== '1' && mode !== 'auto' && fs.existsSync(mode)) {
    return { bin: path.resolve(mode), source: 'env', backend: 'native' }
  }

  const local = resolveLocalIndexSidecarBuild()
  if (local && mode !== 'js' && mode !== '0') {
    return { bin: local, source: 'local-build', backend: 'native' }
  }

  const exe = indexSidecarExeName()
  const fromPath = which(exe.replace(/\.exe$/i, '')) || which('gim-index')
  if (fromPath) return { bin: fromPath, source: 'path', backend: 'native' }

  const runtimeRoot = runtimeIndexSidecarRoot()
  const existing = findFileRecursive(runtimeRoot, [exe])
  if (existing) return { bin: existing, source: 'runtime', backend: 'native' }

  return null
}

/**
 * @param {{ fetch?: boolean }} [opts]
 */
export async function ensureNativeIndexSidecarBin(opts = {}) {
  const hit = resolveNativeIndexSidecarBin()
  if (hit) return hit
  if (!opts.fetch) return null

  let man
  try {
    man = loadManifest('index-sidecar.json')
  } catch {
    return null
  }
  const entry = pickIndexSidecarEntry(man)
  if (!entry?.url || !entry?.sha256) return null

  const cached = await ensureCachedAsset({
    url: entry.url,
    sha256: entry.sha256,
    cacheName: entry.cacheName,
    label: 'gim-index',
  })
  const destDir = runtimeIndexSidecarRoot()
  fs.mkdirSync(destDir, { recursive: true })
  const dest = path.join(destDir, entry.binaryName || indexSidecarExeName())
  if (path.resolve(cached) !== path.resolve(dest)) {
    fs.copyFileSync(cached, dest)
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(dest, 0o755)
      } catch {
        /* */
      }
    }
  }
  return { bin: dest, source: 'manifest', backend: 'native' }
}

/**
 * @param {{ fetch?: boolean }} [opts]
 * @returns {Promise<{ bin: string, source: string, backend: 'native'|'js', node?: boolean }>}
 */
export async function resolveIndexSidecarBackend(opts = {}) {
  const native = await ensureNativeIndexSidecarBin(opts)
  if (native) return native
  return { bin: jsIndexSidecarScript(), source: 'js', backend: 'js', node: true }
}

/**
 * @param {{ port: number, workspaceRoot: string, llamaBase?: string }} opts
 */
export function buildIndexSidecarSpawnSpec(opts) {
  const native = resolveNativeIndexSidecarBin()
  const port = String(opts.port)
  const workspaceRoot = path.resolve(opts.workspaceRoot)

  if (native) {
    const args = ['--port', port, '--workspace', workspaceRoot]
    if (opts.llamaBase) args.push('--llama-url', opts.llamaBase)
    return {
      backend: 'native',
      cmd: native.bin,
      args,
      env: { ...process.env },
    }
  }

  /** @type {Record<string, string>} */
  const env = {
    ...process.env,
    GIM_INDEX_PORT: port,
    GIM_WORKSPACE: workspaceRoot,
  }
  if (opts.llamaBase) env.GIM_LLAMA_URL = opts.llamaBase

  return {
    backend: 'js',
    cmd: process.execPath,
    args: [jsIndexSidecarScript()],
    env,
  }
}

export async function prepareCodeIndexSpawn(opts) {
  const fetchNative =
    process.env.GIM_INDEX_SIDECAR !== 'js' &&
    process.env.GIM_INDEX_SIDECAR !== '0' &&
    process.env.GIM_INDEX_FETCH !== '0'
  if (fetchNative) {
    await ensureNativeIndexSidecarBin({ fetch: true })
  }
  return spawnCodeIndexService(opts)
}

/**
 * @param {{ stack: string, indexPort: number, llamaUrl?: string, logFile: string }} opts
 */
export function spawnCodeIndexService(opts) {
  const workspaceRoot = paths(opts.stack).workspace
  const spec = buildIndexSidecarSpawnSpec({
    port: opts.indexPort,
    workspaceRoot,
    llamaBase: opts.llamaUrl,
  })
  const pid = spawnDetached(spec.cmd, spec.args, { env: spec.env, logFile: opts.logFile })
  return { pid, backend: spec.backend, cmd: spec.cmd }
}

/**
 * Sidecar readiness for doctor / gim index sidecar.
 */
export async function assessIndexSidecar() {
  let manifestEntry = null
  let manifestPinned = false
  try {
    const man = loadManifest('index-sidecar.json')
    manifestEntry = pickIndexSidecarEntry(man)
    manifestPinned = !!(manifestEntry?.url && manifestEntry?.sha256)
  } catch {
    /* */
  }

  const native = resolveNativeIndexSidecarBin()
  const localBuild = resolveLocalIndexSidecarBuild()
  const jsScript = jsIndexSidecarScript()
  const jsOk = fs.existsSync(jsScript)

  return {
    activeBackend: native ? 'native' : 'js',
    native,
    localBuild,
    jsScript,
    jsOk,
    manifestEntry,
    manifestPinned,
    env: process.env.GIM_INDEX_SIDECAR || 'auto',
  }
}

export function formatIndexSidecarReport(report) {
  const lines = ['Index sidecar']
  lines.push(`  backend   ${report.activeBackend}${report.native ? ` (${report.native.source}: ${report.native.bin})` : ''}`)
  if (report.localBuild) {
    lines.push(`  local     cargo build ready: ${report.localBuild}`)
  }
  lines.push(`  js        ${report.jsOk ? 'OK' : 'MISSING'} ${report.jsScript}`)
  if (report.manifestEntry) {
    lines.push(
      `  manifest  ${report.manifestPinned ? 'pinned native available' : 'native url not pinned — JS fallback'}`,
    )
  }
  lines.push(`  env       GIM_INDEX_SIDECAR=${report.env} (auto|js|0|/path/to/gim-index)`)
  return lines.join('\n')
}

/**
 * Run JS index HTTP server in-process (gim-services / sidecar script).
 */
export async function startCodeIndexFromEnv() {
  const port = Number(process.env.GIM_INDEX_PORT || 14150)
  const workspaceRoot = process.env.GIM_WORKSPACE
  if (!workspaceRoot) {
    console.error('GIM_WORKSPACE required')
    process.exit(2)
  }
  const { startCodeIndexServer } = await import('./code-index/server.js')
  const r = await startCodeIndexServer({
    port,
    workspaceRoot,
    llamaBase: process.env.GIM_LLAMA_URL,
  })
  console.log(`[code-index] backend=js listening ${r.url}`)
  return r
}
