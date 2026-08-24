import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { paths, chmodOwnerOnly, appendLog } from './paths.js'

/** Resolve artifact url to a local file path or remote http(s) url. */
export function resolveArtifactSource(url) {
  if (!url) return null
  if (url.startsWith('file:')) {
    const u = new URL(url)
    let p = decodeURIComponent(u.pathname)
    if (process.platform === 'win32' && /^\/[A-Za-z]:\//.test(p)) p = p.slice(1)
    return { kind: 'file', path: path.normalize(p.replace(/\//g, path.sep)) }
  }
  if (/^[A-Za-z]:[\\/]/.test(url) || url.startsWith('/') || url.startsWith('\\\\')) {
    return { kind: 'file', path: path.resolve(url) }
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { kind: 'http', url }
  }
  return null
}

export function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    const ps = `
      Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force
    `
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`unzip failed: ${(r.stderr || r.stdout || '').slice(0, 200)}`)
  } else {
    const r = spawnSync('unzip', ['-o', zipPath, '-d', destDir], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`unzip failed: ${(r.stderr || r.stdout || '').slice(0, 200)}`)
  }
}

/** Find package root inside extracted tree (bin/deep.js present). */
export function findExtractedRoot(dir) {
  const direct = path.join(dir, 'bin', 'deep.js')
  if (fs.existsSync(direct)) return dir
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    const cand = path.join(dir, ent.name)
    if (fs.existsSync(path.join(cand, 'bin', 'deep.js'))) return cand
  }
  throw new Error('extracted archive missing bin/deep.js')
}

export function writeDeepShim(installRoot, version) {
  const deepJs = path.join(installRoot, 'bin', 'deep.js')
  if (!fs.existsSync(deepJs)) throw new Error(`missing ${deepJs}`)

  const binDir =
    process.env.DEEP_PREFIX ||
    (process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'deep', 'bin')
      : path.join(os.homedir(), '.local', 'bin'))

  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    const cmd = path.join(binDir, 'deep.cmd')
    fs.writeFileSync(cmd, `@echo off\r\nnode "${deepJs}" %*\r\n`, 'utf8')
    chmodOwnerOnly(cmd)
    return { binDir, shim: cmd, deepJs, version }
  }

  const shim = path.join(binDir, 'deep')
  fs.writeFileSync(shim, `#!/usr/bin/env bash\nexec node "${deepJs}" "$@"\n`, 'utf8')
  try {
    fs.chmodSync(shim, 0o755)
  } catch {
    /* */
  }
  return { binDir, shim, deepJs, version }
}

/**
 * Extract zip into ~/.deep/runtime/cli/<version> and write PATH shim.
 */
export function installFromZip(zipPath, version) {
  const runtime = path.join(paths().home, 'runtime', 'cli', version)
  fs.rmSync(runtime, { recursive: true, force: true })
  const staging = `${runtime}.extract`
  fs.rmSync(staging, { recursive: true, force: true })
  extractZip(zipPath, staging)
  const root = findExtractedRoot(staging)
  fs.mkdirSync(path.dirname(runtime), { recursive: true })
  fs.renameSync(root, runtime)
  fs.rmSync(staging, { recursive: true, force: true })
  const shim = writeDeepShim(runtime, version)
  appendLog(`event=cli_install version=${version} root=${runtime}`)
  return { ...shim, installRoot: runtime }
}
