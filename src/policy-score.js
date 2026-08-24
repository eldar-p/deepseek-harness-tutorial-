/**
 * Local guardrails / policy score (0–100) for doctor + harness pack.
 * Not enterprise SIEM — host-side isolation posture.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT } from './paths.js'
import { loadManifest } from './download.js'
import { classifyBashRisk, classifyWriteRisk } from './permission-risk.js'
import { isPathInsideRoot } from './workspace-jail.js'

/** @typedef {{ id: string, label: string, weight: number, ok: boolean, detail?: string }} PolicyItem */

/**
 * @returns {{ items: PolicyItem[], score: number, max: number, pct: number, grade: string }}
 */
export function assessPolicyScore() {
  /** @type {PolicyItem[]} */
  const items = []

  function add(id, label, weight, ok, detail) {
    items.push({ id, label, weight, ok, detail })
  }

  add(
    'jail',
    'Workspace jail module',
    15,
    fs.existsSync(path.join(PKG_ROOT, 'src/workspace-jail.js')),
  )
  add(
    'jail-plugin',
    'Jail FS plugin',
    10,
    fs.existsSync(path.join(PKG_ROOT, 'dsh-plugins/workspace-jail-fs/index.mjs')),
  )
  add(
    'one-shot',
    'one-shot-guard + risk',
    15,
    fs.existsSync(path.join(PKG_ROOT, 'dsh-plugins/one-shot-guard/index.mjs')) &&
      fs.existsSync(path.join(PKG_ROOT, 'src/permission-risk.js')),
  )
  add(
    'guest-bash',
    'Guest-only bash plugin',
    10,
    fs.existsSync(path.join(PKG_ROOT, 'dsh-plugins/guest-bash-local/index.mjs')),
  )

  let allowOk = false
  try {
    const a = loadManifest('allowlists.json')
    allowOk = !!(a.balanced || a.allowlist || a.offline)
  } catch {
    allowOk = false
  }
  add('allowlist', 'Network allowlist manifest', 12, allowOk)

  add(
    'egress',
    'Egress proxy script',
    10,
    fs.existsSync(path.join(PKG_ROOT, 'scripts/gim-services.mjs')) ||
      fs.existsSync(path.join(PKG_ROOT, 'src/egress-proxy.js')),
  )
  add(
    'secrets',
    'Secrets template (host-only)',
    8,
    fs.existsSync(path.join(PKG_ROOT, 'src/secrets.js')),
  )

  const denyRm = classifyBashRisk('rm -rf /').level === 'deny'
  const denyEnv = classifyWriteRisk('workspace/.env').level === 'deny'
  add('risk-bash', 'Bash deny rm -rf', 10, denyRm)
  add('risk-write', 'Write deny .env', 10, denyEnv)

  // Live jail sanity (tmpdir)
  let jailLive = false
  try {
    const root = path.join(PKG_ROOT, 'src')
    jailLive = isPathInsideRoot(path.join(root, 'cli.js'), root) === true
    jailLive = jailLive && isPathInsideRoot(path.join(root, '..', 'package.json'), root) === false
  } catch {
    jailLive = false
  }
  add('jail-live', 'Jail path checks', 0, jailLive, 'informational') // weight 0 — already covered; keep for report

  // Rebalance: jail-live was 0; redistribute leftover into existing — weights sum:
  // 15+10+15+10+12+10+8+10+10 = 100. Good.

  const score = items.filter((i) => i.ok && i.weight > 0).reduce((s, i) => s + i.weight, 0)
  const max = items.filter((i) => i.weight > 0).reduce((s, i) => s + i.weight, 0) || 100
  const pct = Math.round((score / max) * 100)
  let grade = 'F'
  if (pct >= 90) grade = 'A'
  else if (pct >= 75) grade = 'B'
  else if (pct >= 60) grade = 'C'
  else if (pct >= 40) grade = 'D'

  return { items, score, max, pct, grade }
}

export function formatPolicyScoreReport(r) {
  const lines = [
    '',
    `Policy score: ${r.pct}% (${r.score}/${r.max}) grade ${r.grade}`,
    '─'.repeat(48),
  ]
  for (const i of r.items.filter((x) => x.weight > 0)) {
    lines.push(`  ${(i.ok ? 'PASS' : 'FAIL').padEnd(5)} ${i.label.padEnd(28)} ${i.ok ? i.weight : 0}/${i.weight}`)
  }
  return lines.join('\n')
}
