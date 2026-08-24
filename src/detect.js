import { spawnSync } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

const WIN_DOCKER_CANDIDATES = [
  process.env.GIM_DOCKER_BIN,
  path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/resources/bin/docker.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Docker/Docker/resources/bin/docker.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Docker/resources/bin/docker.exe'),
].filter(Boolean)

export function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (r.status !== 0) return null
  return (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || null
}

/** Resolve docker/podman binary — PATH, GIM_*_BIN, Windows default install dirs. */
export function resolveEngineBin(prefer = 'docker') {
  const envBin = prefer === 'podman' ? process.env.GIM_PODMAN_BIN : process.env.GIM_DOCKER_BIN
  if (envBin && fs.existsSync(envBin)) return envBin

  const fromPath = which(prefer)
  if (fromPath) return fromPath

  if (process.platform === 'win32' && prefer === 'docker') {
    for (const c of WIN_DOCKER_CANDIDATES) {
      if (c && fs.existsSync(c)) return c
    }
  }
  return null
}

function engineInfo(bin, name) {
  if (!bin) return null
  const info = spawnSync(bin, ['info'], { encoding: 'utf8', windowsHide: true, env: engineEnv(bin) })
  return {
    name,
    bin,
    ok: info.status === 0,
    detail:
      info.status === 0
        ? 'ok'
        : (info.stderr || info.stdout || 'not running').slice(0, 160).replace(/\s+/g, ' ').trim(),
  }
}

/** PATH augmented with docker.exe directory (credential helpers on Windows). */
export function engineEnv(bin) {
  if (!bin) return process.env
  const dir = path.dirname(bin)
  const sep = process.platform === 'win32' ? ';' : ':'
  const cur = process.env.Path || process.env.PATH || ''
  const already =
    cur.toLowerCase().includes(dir.toLowerCase()) &&
    String(process.env.PATH || '')
      .toLowerCase()
      .includes(dir.toLowerCase())
  if (already && process.platform === 'win32' && process.env.Path && process.env.PATH) {
    return process.env
  }
  const next = `${dir}${sep}${cur}`
  if (process.platform === 'win32') {
    // Node + some children read Path; others (and Unix-style tools) read PATH.
    return { ...process.env, Path: next, PATH: next }
  }
  return { ...process.env, PATH: next }
}

/** True when running under WSL (Linux kernel with Microsoft in /proc/version). */
export function isWsl() {
  if (process.platform !== 'linux') return false
  try {
    return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8'))
  } catch {
    return false
  }
}

export function detectContainerEngine() {
  const dockerBin = resolveEngineBin('docker')
  const docker = engineInfo(dockerBin, 'docker')
  if (docker) return docker

  const podmanBin = resolveEngineBin('podman')
  const podman = engineInfo(podmanBin, 'podman')
  if (podman) return podman

  if (process.platform === 'win32') {
    const desktop = path.join(
      process.env.LOCALAPPDATA || '',
      'Programs/DockerDesktop/Docker Desktop.exe',
    )
    const desktopLegacy = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/Docker Desktop.exe')
    if (fs.existsSync(desktop) || fs.existsSync(desktopLegacy)) {
      return {
        name: 'docker',
        bin: null,
        ok: false,
        detail: 'Docker Desktop installed but not running — start Docker Desktop, wait for green whale',
      }
    }
  }
  return { name: null, bin: null, ok: false, detail: 'docker/podman not found — install Docker Desktop' }
}

export function detectGpu() {
  const nvidia = which('nvidia-smi')
  if (nvidia) {
    const r = spawnSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader'], {
      encoding: 'utf8',
    })
    if (r.status === 0) {
      return { kind: 'nvidia', detail: (r.stdout || '').trim().split('\n')[0], discrete: true }
    }
  }
  if (process.platform === 'darwin') {
    return { kind: 'metal', detail: 'Apple Metal (assumed)', discrete: true }
  }
  return { kind: 'cpu', detail: 'no discrete GPU detected', discrete: false }
}

export function detectOsFamily() {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'mac'
  try {
    const text = fs.readFileSync('/etc/os-release', 'utf8')
    if (/fedora|rhel|centos|rocky|alma/i.test(text)) return 'fedora'
    if (/debian|ubuntu|linuxmint|pop|elementary/i.test(text)) return 'debian'
  } catch {
    /* */
  }
  return 'linux'
}

export function isRoot() {
  if (process.platform === 'win32') return false
  return typeof process.getuid === 'function' && process.getuid() === 0
}

export function nodeOk() {
  const major = Number(process.versions.node.split('.')[0])
  return major >= 22
}

export function hostSummary() {
  return {
    platform: process.platform,
    arch: process.arch,
    family: detectOsFamily(),
    node: process.version,
    cpus: os.cpus().length,
    freememGb: Math.round((os.freemem() / 1e9) * 10) / 10,
    totalmemGb: Math.round((os.totalmem() / 1e9) * 10) / 10,
  }
}
