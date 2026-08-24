import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { PKG_ROOT, paths, chmodOwnerOnly, appendLog } from './paths.js'
import { readJsonFile } from './json-io.js'

export function loadManifest(name) {
  const local = path.join(PKG_ROOT, 'manifests', name)
  const cached = path.join(paths().manifestsCache, name)
  const file = fs.existsSync(cached) ? cached : local
  if (!fs.existsSync(file)) throw new Error(`manifest missing: ${name}`)
  return readJsonFile(file)
}

export function sha256File(filePath) {
  const h = createHash('sha256')
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(1024 * 1024)
    let n
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      h.update(buf.subarray(0, n))
    }
  } finally {
    fs.closeSync(fd)
  }
  return h.digest('hex').toLowerCase()
}

/** Stream download; verify sha256 if expected provided (hex). */
export async function downloadFile(url, dest, { expectedSha256 = null, label = 'file' } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.part`
  appendLog(`event=download_start label=${label}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`)
  if (!res.body) throw new Error('download: empty body')
  await pipeline(res.body, createWriteStream(tmp))
  if (expectedSha256) {
    const got = sha256File(tmp)
    const want = expectedSha256.toLowerCase()
    if (got !== want) {
      fs.unlinkSync(tmp)
      throw new Error(`sha256 mismatch for ${label}: got ${got}, want ${want}`)
    }
  }
  fs.renameSync(tmp, dest)
  chmodOwnerOnly(dest)
  appendLog(`event=download_ok label=${label}`)
  return dest
}

export async function ensureCachedAsset({ url, sha256, cacheName, label }) {
  if (!url) throw new Error(`${label}: manifest url is null — set path manually or pin URL`)
  const dest = path.join(paths().manifestsCache, cacheName)
  if (fs.existsSync(dest) && sha256) {
    const got = sha256File(dest)
    if (got === sha256.toLowerCase()) return dest
    fs.unlinkSync(dest)
  }
  if (fs.existsSync(dest) && !sha256) return dest
  await downloadFile(url, dest, { expectedSha256: sha256, label })
  return dest
}
