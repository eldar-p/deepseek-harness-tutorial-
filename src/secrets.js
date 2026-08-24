import fs from 'node:fs'
import path from 'node:path'
import { paths, chmodOwnerOnly } from './paths.js'

/**
 * Host-only secrets store. Guest container must NEVER receive this file.
 * @returns {Record<string, Record<string, string>>}
 */
export function readSecrets() {
  const file = path.join(paths().home, 'secrets.json')
  if (!fs.existsSync(file)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    /** @type {Record<string, Record<string, string>>} */
    const out = {}
    for (const [host, headers] of Object.entries(raw)) {
      if (host.startsWith('_')) continue
      if (headers && typeof headers === 'object') out[host.toLowerCase()] = headers
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Headers to inject for outbound request to host.
 * @param {string} hostname
 * @param {Record<string, Record<string, string>>} secrets
 */
export function secretHeadersForHost(hostname, secrets) {
  const h = String(hostname || '').toLowerCase()
  if (secrets[h]) return { ...secrets[h] }
  for (const [pattern, hdrs] of Object.entries(secrets)) {
    if (h.endsWith(pattern) || h.includes(pattern)) return { ...hdrs }
  }
  return {}
}

export function ensureSecretsTemplate() {
  const home = paths().home
  const secretsPath = path.join(home, 'secrets.json')
  const tpl = path.join(home, 'secrets.template.json')
  if (!fs.existsSync(secretsPath) && !fs.existsSync(tpl)) {
    const sample = {
      _comment: 'Host-only. Never mount into guest. Egress proxy injects headers by hostname.',
      'github.com': { Authorization: 'Bearer YOUR_TOKEN' },
      'api.github.com': { Authorization: 'Bearer YOUR_TOKEN' },
    }
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(tpl, JSON.stringify(sample, null, 2), 'utf8')
    chmodOwnerOnly(tpl)
  }
}
