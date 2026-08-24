import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadManifest, ensureCachedAsset } from './download.js'
import { which, detectGpu } from './detect.js'
import { paths, appendLog } from './paths.js'
import { spawnDetached, killTree, waitHttpOk, extractArchive, findFileRecursive, runLogPath, isPidAlive } from './proc.js'

function exeName() {
  return process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
}

/**
 * Pick llama-server manifest row for this OS/arch.
 * @param {{ binaries?: object[] }} manifest
 * @param {{ preferCuda?: boolean }} opts
 * @returns {object|null}
 */
export function pickBinaryEntry(manifest, { preferCuda }) {
  const bins = manifest.binaries || []
  const plat = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const candidates = bins.filter((b) => b.os === plat && b.arch === arch)
  if (!candidates.length) return null
  if (preferCuda) {
    const cuda = candidates.find((b) => b.variant === 'cuda')
    if (cuda) return cuda
  }
  return candidates.find((b) => b.variant === 'cpu') || candidates[0]
}

/** Resolve llama-server binary: PATH → runtime → fetch from manifest. */
export async function ensureLlamaBinary({ device = 'cpu', fetch = true } = {}) {
  const fromPath = which('llama-server')
  if (fromPath) return { bin: fromPath, source: 'path' }

  const runtimeRoot = paths().runtimeLlama
  const existing = findFileRecursive(runtimeRoot, [exeName()])
  if (existing) return { bin: existing, source: 'runtime' }

  if (process.env.DEEP_LLAMA_BIN && fs.existsSync(process.env.DEEP_LLAMA_BIN)) {
    return { bin: process.env.DEEP_LLAMA_BIN, source: 'env' }
  }

  if (!fetch) {
    throw new Error(
      `llama-server not found. Place binary under ${runtimeRoot} or set DEEP_LLAMA_BIN / PATH`,
    )
  }

  const man = loadManifest('llama-binaries.json')
  const preferCuda = device === 'gpu' && detectGpu().kind === 'nvidia'
  let entry = pickBinaryEntry(man, { preferCuda })
  // Only auto-fetch entries with pinned sha256 (trust). Else fall back to CPU pin.
  if (!entry?.url || !entry.sha256) {
    entry = pickBinaryEntry(man, { preferCuda: false })
  }
  if (!entry?.url || !entry.sha256) {
    throw new Error('llama-binaries.json has no verified url+sha256 for this OS — place llama-server manually')
  }

  console.log(`[INFO] Fetching llama-server (${entry.variant})…`)
  const zip = await ensureCachedAsset({
    url: entry.url,
    sha256: entry.sha256,
    cacheName: entry.cacheName || path.basename(entry.url),
    label: `llama-${entry.variant}`,
  })
  const dest = path.join(runtimeRoot, `${entry.variant}-${entry.tag || 'bin'}`)
  if (!findFileRecursive(dest, [exeName()])) {
    extractArchive(zip, dest)
  }
  // optional cudart sidecar (only when sha pinned)
  if (entry.cudartUrl && entry.cudartSha256) {
    const cz = await ensureCachedAsset({
      url: entry.cudartUrl,
      sha256: entry.cudartSha256,
      cacheName: entry.cudartCacheName || path.basename(entry.cudartUrl),
      label: 'cudart',
    })
    extractArchive(cz, dest)
  }

  const bin = findFileRecursive(dest, [exeName()])
  if (!bin) throw new Error(`llama-server not found after extract in ${dest}`)
  appendLog(`event=llama_bin source=fetch variant=${entry.variant}`)
  return { bin, source: 'fetch', variant: entry.variant }
}

/**
 * @param {{ flagsGguf?: string, configGguf?: string }} [opts]
 * @returns {string|{ needsDownload: boolean, manifest: object }}
 */
export function resolveGguf({ flagsGguf, configGguf } = {}) {
  if (flagsGguf) {
    const p = path.resolve(flagsGguf)
    if (!fs.existsSync(p)) throw Object.assign(new Error(`GGUF not found: ${p}`), { exitCode: 2 })
    return p
  }
  if (configGguf && fs.existsSync(configGguf)) return configGguf
  if (process.env.DEEP_GGUF && fs.existsSync(process.env.DEEP_GGUF)) return process.env.DEEP_GGUF

  const models = paths().models
  if (fs.existsSync(models)) {
    const found = []
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(p)
        else if (ent.name.toLowerCase().endsWith('.gguf')) found.push(p)
      }
    }
    walk(models)
    if (found.length === 1) return found[0]
    if (found.length > 1) {
      throw Object.assign(
        new Error(`Multiple GGUF under ${models} — pass --gguf PATH`),
        { exitCode: 2 },
      )
    }
  }

  const def = loadManifest('default-gguf.json')
  if (def.url) {
    return { needsDownload: true, manifest: def }
  }
  throw Object.assign(
    new Error(
      'No GGUF: pass --gguf PATH, set config, place one file in ~/.deep/models, or pin default-gguf.json url',
    ),
    { exitCode: 2 },
  )
}

export async function maybeDownloadDefaultGguf(def) {
  const dest = path.join(paths().models, def.filename || `${def.name || 'model'}.gguf`)
  if (fs.existsSync(dest) && def.sha256) {
    const { sha256File } = await import('./download.js')
    if (sha256File(dest) === def.sha256.toLowerCase()) return dest
  }
  console.log(`[INFO] Downloading default GGUF ${def.name || ''}…`)
  const { downloadFile } = await import('./download.js')
  await downloadFile(def.url, dest, { expectedSha256: def.sha256, label: 'default-gguf' })
  return dest
}

export async function startLlama({ stack, bin, gguf, port, device }) {
  const ngl = device === 'gpu' ? '99' : '0'
  const args = [
    '-m',
    gguf,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '-ngl',
    ngl,
    '-c',
    '8192',
  ]
  const logFile = runLogPath(stack, 'llama')
  const cwd = path.dirname(bin)
  console.log(`[YELLOW] Llama warming — ${path.basename(bin)} :${port}`)
  const pid = spawnDetached(bin, args, { cwd, logFile })
  appendLog(`event=llama_spawn pid=${pid} port=${port} device=${device}`)
  return { pid, port, warming: true }
}

export async function waitLlamaHealthy(port, { onTick } = {}) {
  const health = `http://127.0.0.1:${port}/health`
  const models = `http://127.0.0.1:${port}/v1/models`
  const start = Date.now()
  const timeoutMs = 300_000
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await fetch(health, { signal: AbortSignal.timeout(2000) })
      if (h.ok) {
        try {
          await fetch(models, { signal: AbortSignal.timeout(2000) })
        } catch {
          /* optional */
        }
        return true
      }
    } catch {
      /* warming */
    }
    if (onTick) onTick()
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`llama health timeout — check ${runLogPath('default', 'llama')}`)
}

export function stopLlama(pid, { emergency = false } = {}) {
  if (!pid) return
  killTree(pid, { force: emergency })
}

export function llamaStatusFromRun(run) {
  if (!run?.pids?.llama) return { level: 'red', detail: 'not started' }
  if (!isPidAlive(run.pids.llama)) return { level: 'red', detail: `dead pid=${run.pids.llama}` }
  if (run.warming) return { level: 'yellow', detail: run.urls?.llama || 'warming' }
  return { level: 'green', detail: run.urls?.llama || `pid=${run.pids.llama}` }
}

export function hostThreads() {
  return Math.max(2, Math.min(os.cpus().length, 8))
}
