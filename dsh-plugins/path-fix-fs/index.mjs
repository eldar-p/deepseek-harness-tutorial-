/**
 * Path-fix FS backend: rewrite hallucinated / VM-home / tmp paths onto the
 * Windows share before resolve.
 *
 * Set HOST_SHARE (Windows path). Default guest mount: /mnt/hostshare
 * Optional VM_USER for /home/<user> rewrites (default: kodachi).
 */
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox'

const SHARE = (process.env.HOST_SHARE || 'D:\\vm-share').replace(/\//g, '\\')
const VM_USER = process.env.VM_SSH_USER || process.env.VM_USER || 'kodachi'
const homeRe = new RegExp(`^/home/${VM_USER}(/.*)?$`, 'i')
const homeWinRe = new RegExp(`^[A-Za-z]:\\\\home\\\\${VM_USER}(?=\\\\|$)`, 'i')
const homeBareRe = new RegExp(`^\\\\home\\\\${VM_USER}(?=\\\\|$)`, 'i')

/** @param {string} input */
export function rewritePath(input) {
  if (typeof input !== 'string' || input.length === 0) return input

  const unix = input.replace(/\\/g, '/')

  {
    const m = unix.match(/^\/mnt\/hostshare(\/.*)?$/i)
    if (m) {
      const rest = (m[1] || '').replace(/\//g, '\\')
      return rest ? SHARE + rest : SHARE
    }
  }

  {
    const m = unix.match(homeRe)
    if (m) {
      const rest = (m[1] || '').replace(/\//g, '\\')
      return rest ? SHARE + rest : SHARE
    }
  }

  {
    const m = unix.match(/^\/tmp(\/.*)?$/i)
    if (m) {
      const rest = (m[1] || '').replace(/\//g, '\\')
      return rest ? `${SHARE}\\tmp${rest}` : `${SHARE}\\tmp`
    }
  }

  let p = input.replace(/\//g, '\\')
  if (!p.startsWith('\\\\')) p = p.replace(/\\{2,}/g, '\\')

  p = p.replace(/^\\mnt\\hostshare(?=\\|$)/i, SHARE)
  p = p.replace(/^[A-Za-z]:\\mnt\\hostshare(?=\\|$)/i, SHARE)
  p = p.replace(/^[A-Za-z]:mnt\\hostshare(?=\\|$)/i, SHARE)
  p = p.replace(homeWinRe, SHARE)
  p = p.replace(/^[A-Za-z]:\\tmp(?=\\|$)/i, `${SHARE}\\tmp`)
  p = p.replace(homeBareRe, SHARE)

  return p
}

class PathFixFs extends SandboxedFileSystem {
  resolve(path, opts) {
    return super.resolve(rewritePath(path), opts)
  }

  lstat(path, opts, signal) {
    return super.lstat(rewritePath(path), opts, signal)
  }
}

export default PathFixFs
