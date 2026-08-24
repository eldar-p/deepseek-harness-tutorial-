import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { rotateLogIfLarge } from './io-policy.js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PKG_ROOT = path.resolve(__dirname, '..')

export function gimHome() {
  return process.env.GIM_HOME || path.join(os.homedir(), '.gim')
}

export function paths(stack = 'default') {
  const home = gimHome()
  return {
    home,
    config: path.join(home, 'config.json'),
    models: path.join(home, 'models'),
    runtimeLlama: path.join(home, 'runtime', 'llama'),
    dshHome: path.join(home, 'dsh-home'),
    workspace: path.join(home, 'workspace', stack),
    memory: path.join(home, 'workspace', stack, '.gim', 'memory.json'),
    structure: path.join(home, 'workspace', stack, 'STRUCTURE.txt'),
    workspaceLogs: path.join(home, 'workspace', stack, 'logs'),
    run: path.join(home, 'run', stack),
    logs: path.join(home, 'logs'),
    gimLog: path.join(home, 'logs', 'gim.log'),
    manifestsCache: path.join(home, 'manifests-cache'),
    presets: path.join(home, 'presets'),
    lockGpu: path.join(home, 'run', '.gpu.lock'),
  }
}

export function ensureDirs(stack = 'default') {
  const p = paths(stack)
  for (const d of [
    p.home,
    p.models,
    p.runtimeLlama,
    path.join(p.home, 'runtime', 'gim-index'),
    p.dshHome,
    p.workspace,
    path.dirname(p.memory),
    p.workspaceLogs,
    p.run,
    p.logs,
    p.manifestsCache,
    p.presets,
    path.join(p.home, 'diagnostics'),
  ]) {
    fs.mkdirSync(d, { recursive: true })
  }
  return p
}

/** Restrictive mode on POSIX; best-effort on Windows */
export function chmodOwnerOnly(filePath) {
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    /* ignore on win */
  }
}

export function appendLog(line) {
  const p = paths()
  fs.mkdirSync(p.logs, { recursive: true })
  rotateLogIfLarge(p.gimLog)
  const stamp = new Date().toISOString()
  // Never log prompt bodies — callers must pass redacted events only
  fs.appendFileSync(p.gimLog, `${stamp} ${line}\n`, { encoding: 'utf8' })
  chmodOwnerOnly(p.gimLog)
}
