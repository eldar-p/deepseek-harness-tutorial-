import fs from 'node:fs'
import path from 'node:path'

export class JailEscapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'JailEscapeError'
    this.exitCode = 2
  }
}

/**
 * True if candidate resolves inside root (rejects prefix tricks + symlink escapes).
 * @param {string} candidate
 * @param {string} root
 */
export function isPathInsideRoot(candidate, root) {
  const rootAbs = path.resolve(root)
  const targetAbs = path.resolve(candidate)

  // If the workspace root does not exist yet, compare logical paths only.
  // Otherwise macOS may realpath /home (symlink) for the target while leaving
  // a non-existent root unresolved, which false-triggers escapes in unit tests.
  if (!fs.existsSync(rootAbs)) {
    const rel = path.relative(rootAbs, targetAbs)
    if (rel === '') return true
    if (rel.startsWith('..') || path.isAbsolute(rel)) return false
    return true
  }

  let rootReal = rootAbs
  try {
    rootReal = fs.realpathSync(rootAbs)
  } catch {
    /* keep rootAbs */
  }

  let targetReal = targetAbs
  try {
    if (fs.existsSync(targetAbs)) {
      targetReal = fs.realpathSync(targetAbs)
    } else {
      // Walk up to an existing ancestor, then re-join the missing suffix.
      const missing = []
      let cur = targetAbs
      while (cur && cur !== path.dirname(cur) && !fs.existsSync(cur)) {
        missing.unshift(path.basename(cur))
        cur = path.dirname(cur)
      }
      if (fs.existsSync(cur)) {
        targetReal = path.join(fs.realpathSync(cur), ...missing)
      }
    }
  } catch {
    targetReal = targetAbs
  }

  const rel = path.relative(rootReal, targetReal)
  if (rel === '') return true
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false
  return true
}

/**
 * Rewrite guest/virtual paths onto the GIM workspace root.
 * Throws JailEscapeError if a mapped path would escape the root (incl. symlinks).
 * @param {string} input
 * @param {string} workspaceRoot absolute host path
 */
export function rewriteWorkspacePath(input, workspaceRoot) {
  if (typeof input !== 'string' || input.length === 0) return input
  const ROOT = (workspaceRoot || '').replace(/\//g, path.sep)
  if (!ROOT) return input

  const unix = input.replace(/\\/g, '/')
  let mapped = null

  {
    const m = unix.match(/^\/workspace(\/.*)?$/i)
    if (m) {
      const rest = (m[1] || '').replace(/\//g, path.sep)
      mapped = rest ? path.join(ROOT, rest) : ROOT
    }
  }

  // Host paths already inside the workspace must not be remapped via guest /home|/tmp.
  if (!mapped) {
    try {
      const resolved = path.resolve(input)
      if (isPathInsideRoot(resolved, ROOT)) return path.resolve(resolved)
    } catch {
      /* */
    }
  }

  if (!mapped) {
    const m = unix.match(/^\/(tmp|home)(\/.*)?$/i)
    if (m) {
      const rest = (m[2] || '').replace(/\//g, path.sep)
      mapped = rest ? path.join(ROOT, 'tmp', rest) : path.join(ROOT, 'tmp')
    }
  }

  if (!mapped) return input

  const resolved = path.resolve(mapped)
  if (!isPathInsideRoot(resolved, ROOT)) {
    throw new JailEscapeError(`path escapes workspace: ${input}`)
  }
  return resolved
}
