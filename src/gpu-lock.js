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

/** Simple file lock for GPU allocate (pre-alpha). */
export async function withGpuLock(fn, { timeoutMs = 120_000 } = {}) {
  const lockPath = paths().lockGpu
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  const start = Date.now()
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx')
      fs.writeFileSync(fd, String(process.pid))
      fs.closeSync(fd)
      break
    } catch {
      if (Date.now() - start > timeoutMs) {
        throw Object.assign(new Error('GPU lock timeout'), { exitCode: 3 })
      }
      try {
        const pid = Number(fs.readFileSync(lockPath, 'utf8').trim())
        if (pid && !isPidAlive(pid)) fs.unlinkSync(lockPath)
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
        const pid = Number(fs.readFileSync(lockPath, 'utf8').trim())
        if (pid === process.pid) fs.unlinkSync(lockPath)
      }
    } catch {
      /* ignore */
    }
  }
}
