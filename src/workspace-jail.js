import path from 'node:path'

/**
 * Rewrite guest/virtual paths onto the Deep workspace root.
 * @param {string} input
 * @param {string} workspaceRoot absolute host path
 */
export function rewriteWorkspacePath(input, workspaceRoot) {
  if (typeof input !== 'string' || input.length === 0) return input
  const ROOT = (workspaceRoot || '').replace(/\//g, path.sep)
  if (!ROOT) return input

  const unix = input.replace(/\\/g, '/')

  {
    const m = unix.match(/^\/workspace(\/.*)?$/i)
    if (m) {
      const rest = (m[1] || '').replace(/\//g, path.sep)
      return rest ? path.join(ROOT, rest) : ROOT
    }
  }

  {
    const m = unix.match(/^\/(tmp|home)(\/.*)?$/i)
    if (m) {
      const rest = (m[2] || '').replace(/\//g, path.sep)
      return rest ? path.join(ROOT, 'tmp', rest) : path.join(ROOT, 'tmp')
    }
  }

  try {
    const resolved = path.resolve(input)
    const rootResolved = path.resolve(ROOT)
    const cmp =
      process.platform === 'win32'
        ? resolved.toLowerCase().startsWith(rootResolved.toLowerCase())
        : resolved.startsWith(rootResolved)
    if (cmp) return resolved
  } catch {
    /* */
  }
  return input
}
