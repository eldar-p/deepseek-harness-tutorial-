/**
 * Workspace path jail for GIM: rewrite guest /workspace and stray paths onto host workspace.
 * Env: GIM_WORKSPACE (absolute host path).
 */
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox'
import { rewriteWorkspacePath } from './jail-core.mjs'

const ROOT = (process.env.GIM_WORKSPACE || process.env.HOST_SHARE || '').replace(/\\/g, '/')

/** @param {string} input */
export function rewritePath(input) {
  return rewriteWorkspacePath(input, ROOT.replace(/\//g, '\\'))
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
