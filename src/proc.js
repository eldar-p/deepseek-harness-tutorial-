import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { paths } from './paths.js'

export function spawnDetached(bin, args, { cwd, env, logFile, shell = false } = {}) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  const out = fs.openSync(logFile, 'a')
  const useShell = shell || (process.platform === 'win32' && /\.cmd$/i.test(bin))
  const child = spawn(bin, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
    shell: useShell,
  })
  child.on('error', (err) => {
    try {
      fs.writeSync(out, `\n[spawn error] ${err.message}\n`)
    } catch {
      /* */
    }
  })
  child.unref()
  return child.pid
}

/** Kill process tree. On Windows uses taskkill /T. */
export function killTree(pid, { force = false } = {}) {
  if (!pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', force ? '/F' : ''], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return
  }
  try {
    process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM')
  } catch {
    try {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
    } catch {
      /* already dead */
    }
  }
}

export function isPidAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function waitHttpOk(url, { timeoutMs = 180_000, intervalMs = 2000, label = 'service' } = {}) {
  const start = Date.now()
  let lastErr = ''
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return true
      lastErr = `HTTP ${res.status}`
    } catch (e) {
      lastErr = e.message || String(e)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`${label} not ready after ${timeoutMs}ms (${lastErr}) — ${url}`)
}

export function extractArchive(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    const r = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) throw new Error(`Expand-Archive failed: ${r.stderr || r.stdout}`)
    return
  }
  const r = spawnSync('tar', ['-xf', archivePath, '-C', destDir], { encoding: 'utf8' })
  if (r.status !== 0) {
    const u = spawnSync('unzip', ['-o', archivePath, '-d', destDir], { encoding: 'utf8' })
    if (u.status !== 0) throw new Error(`extract failed: ${r.stderr || u.stderr}`)
  }
}

export function findFileRecursive(root, names) {
  const want = new Set(names.map((n) => n.toLowerCase()))
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let ents
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of ents) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) stack.push(p)
      else if (want.has(ent.name.toLowerCase())) return p
    }
  }
  return null
}

export function runLogPath(stack, name) {
  return path.join(paths(stack).run, `${name}.log`)
}
