import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { rotateLogIfLarge } from './io-policy.js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PKG_ROOT = path.resolve(__dirname, '..')

export function deepHome() {
  return process.env.DEEP_HOME || path.join(os.homedir(), '.deep')
}

export function paths(stack = 'default') {
  const home = deepHome()
  return {
    home,
    config: path.join(home, 'config.json'),
    models: path.join(home, 'models'),
    runtimeLlama: path.join(home, 'runtime', 'llama'),
    dshHome: path.join(home, 'dsh-home'),
    workspace: path.join(home, 'workspace', stack),
    memory: path.join(home, 'workspace', stack, '.deep', 'memory.json'),
    structure: path.join(home, 'workspace', stack, 'STRUCTURE.txt'),
    workspaceLogs: path.join(home, 'workspace', stack, 'logs'),
    run: path.join(home, 'run', stack),
    logs: path.join(home, 'logs'),
    deepLog: path.join(home, 'logs', 'deep.log'),
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
    p.dshHome,
    p.workspace,
    path.dirname(p.memory),
    p.workspaceLogs,
    p.run,
    p.logs,
    p.manifestsCache,
    p.presets,
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
  rotateLogIfLarge(p.deepLog)
  const stamp = new Date().toISOString()
  // Never log prompt bodies — callers must pass redacted events only
  fs.appendFileSync(p.deepLog, `${stamp} ${line}\n`, { encoding: 'utf8' })
  chmodOwnerOnly(p.deepLog)
}
