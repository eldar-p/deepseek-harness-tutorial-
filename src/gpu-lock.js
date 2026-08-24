import fs from 'node:fs'
import path from 'node:path'
import { paths } from './paths.js'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readGpuLock() {
  const lockPath = paths().lockGpu
  if (!fs.existsSync(lockPath)) return null
  try {
    const raw = fs.readFileSync(lockPath, 'utf8').trim()
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return { pid: n, stack: null }
    const j = JSON.parse(raw)
    if (j?.pid) return { pid: j.pid, stack: j.stack || null }
  } catch {
    /* */
  }
  return null
}

/** Simple file lock for GPU allocate — one GPU stack at a time. */
export async function withGpuLock(fn, { stack = 'default', timeoutMs = 120_000 } = {}) {
  const lockPath = paths().lockGpu
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  const start = Date.now()
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx')
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, stack }))
      fs.closeSync(fd)
      break
    } catch {
      if (Date.now() - start > timeoutMs) {
        const held = readGpuLock()
        const who = held?.stack ? `stack "${held.stack}"` : `pid ${held?.pid || '?'}`
        throw Object.assign(new Error(`GPU lock timeout — held by ${who}`), { exitCode: 3 })
      }
      try {
        const held = readGpuLock()
        if (held?.pid && !isPidAlive(held.pid)) fs.unlinkSync(lockPath)
      } catch {
        /* retry */
      }
      await sleep(100)
    }
  }
  try {
    return await fn()
  } finally {
    try {
      if (fs.existsSync(lockPath)) {
        const held = readGpuLock()
        if (held?.pid === process.pid) fs.unlinkSync(lockPath)
      }
    } catch {
      /* ignore */
    }
  }
}

/** Returns blocking stack name if GPU is held by another live process. */
export function gpuLockHolder(excludeStack = null) {
  const held = readGpuLock()
  if (!held?.pid || !isPidAlive(held.pid)) return null
  if (held.stack && held.stack !== excludeStack) return held.stack
  if (!held.stack && held.pid !== process.pid) return `pid:${held.pid}`
  return null
}
