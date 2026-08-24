import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths } from './paths.js'
import { readConfig } from './config.js'
import { detectContainerEngine, detectGpu, nodeOk, which } from './detect.js'
import { findFileRecursive } from './proc.js'

/** Pre-alpha milestone weights (sum = 100). */
export const PREALPHA_MILESTONES = [
  { id: 'cli', label: 'CLI commands', weight: 10, check: () => fs.existsSync(path.join(PKG_ROOT, 'bin/deep.js')) },
  { id: 'config', label: 'Bootstrap / config', weight: 8, check: () => fs.existsSync(paths().config) },
  { id: 'llama-bin', label: 'llama-server binary', weight: 12, check: () => {
    if (which('llama-server') || process.env.DEEP_LLAMA_BIN) return true
    const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
    return !!findFileRecursive(paths().runtimeLlama, [exe])
  }},
  { id: 'gguf', label: 'GGUF configured', weight: 10, check: () => {
    const cfg = readConfig()
    if (cfg?.gguf && fs.existsSync(cfg.gguf)) return true
    const models = paths().models
    if (!fs.existsSync(models)) return false
    return walkGguf(models).length > 0
  }},
  { id: 'llama-run', label: 'Llama spawn tested', weight: 15, check: () => stackWasStarted('llama') },
  { id: 'dsh', label: 'DSH on PATH', weight: 8, check: () => !!which('dsh') },
  { id: 'dsh-run', label: 'DSH spawn tested', weight: 10, check: () => stackWasStarted('dsh') },
  { id: 'guest-engine', label: 'Container engine', weight: 10, check: () => detectContainerEngine().ok },
  { id: 'guest-run', label: 'Guest container smoke', weight: 12, check: () => {
    const st = path.join(paths('default').run, 'state.json')
    if (!fs.existsSync(st)) return false
    try {
      const s = JSON.parse(fs.readFileSync(st, 'utf8'))
      return s.guestRunning === true
    } catch {
      return false
    }
  }},
  { id: 'infra', label: 'Infra docs + LICENSE', weight: 5, check: () =>
    fs.existsSync(path.join(PKG_ROOT, 'LICENSE')) &&
    fs.existsSync(path.join(PKG_ROOT, 'docs/INFRASTRUCTURE.md')),
  },
]

function walkGguf(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walkGguf(p))
    else if (ent.name.toLowerCase().endsWith('.gguf')) out.push(p)
  }
  return out
}

function stackWasStarted(which) {
  const st = path.join(paths('default').run, 'state.json')
  if (!fs.existsSync(st)) return false
  try {
    const s = JSON.parse(fs.readFileSync(st, 'utf8'))
    if (which === 'llama') return !!s.pids?.llama
    if (which === 'dsh') return !!s.pids?.dsh
  } catch {
    return false
  }
  return false
}

export function assessPreAlphaReadiness() {
  const items = PREALPHA_MILESTONES.map((m) => {
    let ok = false
    try {
      ok = !!m.check()
    } catch {
      ok = false
    }
    return { ...m, ok, earned: ok ? m.weight : 0 }
  })
  const score = items.reduce((s, i) => s + i.earned, 0)
  const max = items.reduce((s, i) => s + i.weight, 0)
  const pct = Math.round((score / max) * 100)
  let stage = 'early'
  if (pct >= 85) stage = 'complete'
  else if (pct >= 65) stage = 'late'
  else if (pct >= 40) stage = 'mid'
  return { items, score, max, pct, stage }
}

export function formatReadinessReport(r, { host, engine, gpu } = {}) {
  const lines = []
  lines.push('')
  lines.push(`Pre-alpha readiness: ${r.pct}% (${r.score}/${r.max}) — stage: ${r.stage}`)
  lines.push('─'.repeat(48))
  for (const i of r.items) {
    const tag = i.ok ? 'DONE' : 'TODO'
    lines.push(`  ${tag.padEnd(5)} ${i.label.padEnd(24)} ${i.ok ? i.weight : 0}/${i.weight}`)
  }
  if (r.stage !== 'complete') {
    lines.push('─'.repeat(48))
    const next = r.items.filter((i) => !i.ok).slice(0, 3)
    if (next.length) {
      lines.push('Next:')
      for (const n of next) lines.push(`  • ${n.label}`)
    }
  }
  if (host) lines.push(`\nHost: ${host.platform}/${host.arch}  node=${host.node}  gpu=${gpu?.kind}`)
  if (engine && !engine.ok) lines.push(`Hint: install Docker/Podman for guest milestone (+${PREALPHA_MILESTONES.find((m) => m.id === 'guest-run')?.weight || 12}%)`)
  return lines.join('\n')
}
