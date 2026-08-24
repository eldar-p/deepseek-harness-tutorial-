/**
 * Lightweight agent/session metrics — ~/.gim/metrics/*.jsonl
 * No PII/prompts; timings + tool counts only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { paths, chmodOwnerOnly } from './paths.js'

export function metricsEnabled() {
  return process.env.GIM_METRICS !== '0'
}

function metricsDir() {
  return path.join(paths().home, 'metrics')
}

/**
 * @param {string} name e.g. agent
 */
export function metricsLogPath(name = 'agent') {
  return path.join(metricsDir(), `${name}.jsonl`)
}

/**
 * @param {string} name
 * @param {object} record
 */
export function recordMetric(name, record) {
  if (!metricsEnabled()) return
  try {
    const dir = metricsDir()
    fs.mkdirSync(dir, { recursive: true })
    const f = metricsLogPath(name)
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...record,
    })
    fs.appendFileSync(f, `${line}\n`, 'utf8')
    chmodOwnerOnly(f)
  } catch {
    /* never break agent */
  }
}

/**
 * @param {string} [name]
 * @param {{ limit?: number }} [opts]
 */
export function readMetrics(name = 'agent', { limit = 50 } = {}) {
  const f = metricsLogPath(name)
  if (!fs.existsSync(f)) return []
  const lines = fs.readFileSync(f, 'utf8').trim().split(/\n/).filter(Boolean)
  /** @type {object[]} */
  const out = []
  for (const line of lines.slice(-limit)) {
    try {
      out.push(JSON.parse(line))
    } catch {
      /* */
    }
  }
  return out
}

/**
 * Summarize recent agent runs for doctor / KI.
 * @param {{ limit?: number }} [opts]
 */
export function summarizeAgentMetrics({ limit = 40 } = {}) {
  const rows = readMetrics('agent', { limit })
  if (!rows.length) {
    return { ok: true, n: 0, meanRoundMs: null, meanTools: null, p95RoundMs: null }
  }
  const durations = rows.map((r) => Number(r.durationMs) || 0).filter((n) => n > 0).sort((a, b) => a - b)
  const tools = rows.map((r) => Number(r.toolCalls) || 0)
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const p95 = durations.length
    ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
    : null
  return {
    ok: true,
    n: rows.length,
    meanRoundMs: mean(durations) != null ? Math.round(mean(durations)) : null,
    p95RoundMs: p95 != null ? Math.round(p95) : null,
    meanTools: mean(tools) != null ? Number(mean(tools).toFixed(1)) : null,
    meanRounds: mean(rows.map((r) => Number(r.rounds) || 0)),
  }
}

/**
 * @param {ReturnType<typeof summarizeAgentMetrics>} s
 */
export function formatMetricsSummary(s) {
  if (!s.n) return 'Agent metrics: no samples yet (runs appear after agent turns)'
  return `Agent metrics (last ${s.n}): mean=${s.meanRoundMs}ms  p95=${s.p95RoundMs}ms  tools/turn≈${s.meanTools}  rounds≈${s.meanRounds?.toFixed?.(1) ?? s.meanRounds}`
}
