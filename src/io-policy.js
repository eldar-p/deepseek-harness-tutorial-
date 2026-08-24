import fs from 'node:fs'
import path from 'node:path'
import { chmodOwnerOnly } from './paths.js'

/** Soft cap for deep.log before rotate (SSD-friendly, events-only log). */
export const DEEP_LOG_MAX_BYTES = Number(process.env.DEEP_LOG_MAX_BYTES || 512 * 1024)

/** Rotate deep.log → deep.log.1 when over cap; keep one generation only. */
export function rotateLogIfLarge(logPath, { maxBytes = DEEP_LOG_MAX_BYTES } = {}) {
  if (!fs.existsSync(logPath)) return false
  const size = fs.statSync(logPath).size
  if (size <= maxBytes) return false
  const rotated = `${logPath}.1`
  try {
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated)
    fs.renameSync(logPath, rotated)
    chmodOwnerOnly(rotated)
  } catch {
    fs.writeFileSync(logPath, '', 'utf8')
  }
  return true
}

/** Remove stale *.part download temps (crash/interrupt leftovers). */
export function cleanStalePartFiles(dir, { maxAgeMs = 3600_000 } = {}) {
  if (!fs.existsSync(dir)) return 0
  const now = Date.now()
  let removed = 0
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.part')) continue
    const p = path.join(dir, name)
    try {
      const age = now - fs.statSync(p).mtimeMs
      if (age > maxAgeMs) {
        fs.unlinkSync(p)
        removed++
      }
    } catch {
      /* */
    }
  }
  return removed
}
