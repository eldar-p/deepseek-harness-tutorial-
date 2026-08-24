import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

/**
 * @param {string} filePath
 * @returns {string} lowercase hex sha256
 */
export function sha256File(filePath) {
  const h = createHash('sha256')
  h.update(fs.readFileSync(filePath))
  return h.digest('hex').toLowerCase()
}

/**
 * Write `<file>.sha256` sidecar: `HEX  basename`
 * @param {string} filePath
 * @returns {string} sidecar path
 */
export function writeSha256Sidecar(filePath) {
  const hex = sha256File(filePath)
  const side = `${filePath}.sha256`
  const line = `${hex}  ${path.basename(filePath)}\n`
  fs.writeFileSync(side, line, 'utf8')
  return side
}

/**
 * Verify file against sidecar or expected hex.
 * @param {string} filePath
 * @param {{ expected?: string, sidecar?: string }} [opts]
 * @returns {{ ok: boolean, got: string, want: string|null, detail: string }}
 */
export function verifySha256(filePath, { expected = null, sidecar = null } = {}) {
  const got = sha256File(filePath)
  let want = expected ? expected.toLowerCase() : null
  const sidePath = sidecar || `${filePath}.sha256`
  if (!want && fs.existsSync(sidePath)) {
    const text = fs.readFileSync(sidePath, 'utf8').trim()
    const m = text.match(/^([a-fA-F0-9]{64})\b/)
    want = m ? m[1].toLowerCase() : null
  }
  if (!want) return { ok: false, got, want: null, detail: 'no expected hash or sidecar' }
  if (got !== want) return { ok: false, got, want, detail: 'sha256 mismatch' }
  return { ok: true, got, want, detail: 'ok' }
}
