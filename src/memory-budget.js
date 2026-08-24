import fs from 'node:fs'
import path from 'node:path'

/** Soft caps inspired by Claude Code memdir (pattern only). */
export const MEMORY_MAX_BYTES = 25 * 1024
export const CONTEXT_MAX_BYTES = 20 * 1024
export const MEMORY_MAX_FACTS = 40
export const MEMORY_MAX_RECENT = 30

/**
 * @param {string} filePath
 * @param {number} maxBytes
 * @returns {{ ok: boolean, bytes: number, maxBytes: number, warn?: string }}
 */
export function checkFileBudget(filePath, maxBytes) {
  if (!fs.existsSync(filePath)) {
    return { ok: true, bytes: 0, maxBytes }
  }
  const bytes = fs.statSync(filePath).size
  if (bytes <= maxBytes) return { ok: true, bytes, maxBytes }
  return {
    ok: false,
    bytes,
    maxBytes,
    warn: `${path.basename(filePath)} is ${bytes} bytes (cap ${maxBytes}) — move detail to topic files`,
  }
}

/**
 * Validate workspace memory.json shape + size.
 * @param {string} memoryPath
 */
export function assessMemoryJson(memoryPath) {
  const file = checkFileBudget(memoryPath, MEMORY_MAX_BYTES)
  /** @type {{ ok: boolean, warns: string[], facts?: number, recent?: number }} */
  const out = { ok: file.ok, warns: [] }
  if (file.warn) out.warns.push(file.warn)
  if (!fs.existsSync(memoryPath)) return out
  try {
    const j = JSON.parse(fs.readFileSync(memoryPath, 'utf8'))
    const facts = Array.isArray(j.facts) ? j.facts.length : 0
    const recent = Array.isArray(j.recentChanges) ? j.recentChanges.length : 0
    out.facts = facts
    out.recent = recent
    if (facts > MEMORY_MAX_FACTS) {
      out.ok = false
      out.warns.push(`memory.facts has ${facts} entries (cap ${MEMORY_MAX_FACTS})`)
    }
    if (recent > MEMORY_MAX_RECENT) {
      out.ok = false
      out.warns.push(`memory.recentChanges has ${recent} entries (cap ${MEMORY_MAX_RECENT})`)
    }
  } catch (e) {
    out.ok = false
    out.warns.push(`memory.json parse error: ${e.message}`)
  }
  return out
}

/**
 * @param {{ workspace: string, memory: string }} p paths(stack)
 * @returns {{ ok: boolean, warns: string[] }}
 */
export function assessWorkspaceMemoryBudget(p) {
  const warns = []
  let ok = true
  const mem = assessMemoryJson(p.memory)
  if (!mem.ok) ok = false
  warns.push(...mem.warns)
  const ctxPath = path.join(path.dirname(p.memory), 'CONTEXT.md')
  const ctx = checkFileBudget(ctxPath, CONTEXT_MAX_BYTES)
  if (!ctx.ok) {
    ok = false
    if (ctx.warn) warns.push(ctx.warn)
  }
  return { ok, warns }
}
