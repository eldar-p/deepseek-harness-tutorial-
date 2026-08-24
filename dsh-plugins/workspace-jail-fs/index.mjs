/**
 * Workspace path jail for Deep: rewrite guest /workspace and stray paths onto host workspace.
 * Env: DEEP_WORKSPACE (absolute host path).
 */
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox'
import path from 'node:path'

const ROOT = (process.env.DEEP_WORKSPACE || process.env.HOST_SHARE || '').replace(/\//g, path.sep)

/** @param {string} input */
export function rewritePath(input) {
  if (typeof input !== 'string' || input.length === 0) return input
  if (!ROOT) return input

  const unix = input.replace(/\\/g, '/')

  {
    const m = unix.match(/^\/workspace(\/.*)?$/i)
    if (m) {
      const rest = (m[1] || '').replace(/\//g, path.sep)
      return rest ? path.join(ROOT, rest) : ROOT
    }
  }

  // deny common escape targets by forcing under workspace
  {
    const m = unix.match(/^\/(tmp|home)(\/.*)?$/i)
    if (m) {
      const rest = (m[2] || '').replace(/\//g, path.sep)
      return rest ? path.join(ROOT, 'tmp', rest) : path.join(ROOT, 'tmp')
    }
  }

  let p = input
  // if absolute and outside ROOT on win/posix — keep as-is for sandbox to reject
  try {
    const resolved = path.resolve(p)
    const rootResolved = path.resolve(ROOT)
    if (resolved.toLowerCase().startsWith(rootResolved.toLowerCase())) return resolved
  } catch {
    /* */
  }
  return p
}

class WorkspaceJailFs extends SandboxedFileSystem {
  resolve(p, opts) {
    return super.resolve(rewritePath(p), opts)
  }

  lstat(p, opts, signal) {
    return super.lstat(rewritePath(p), opts, signal)
  }
}

export default WorkspaceJailFs
