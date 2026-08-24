/**
 * GIM Diagnostics Service — structured errors, health scan, log hints.
 * Persist: ~/.gim/diagnostics/<stack>.jsonl
 */
import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, appendLog, chmodOwnerOnly } from './paths.js'
import { readJsonFile } from './json-io.js'
import { readRunState, stackIsActive } from './runstate.js'
import { detectContainerEngine, detectGpu, hostSummary, nodeOk } from './detect.js'
import { readConfig } from './config.js'
import { isApiMode } from './api-provider.js'
import { resolveLlmDockerBackend } from './llm-docker.js'
import {
  colibriNativeEngineReady,
  resolveColibriModelPath,
  colibriModelReady,
} from './colibri.js'
import { indexStatus, defaultIndexDir } from './code-index/indexer.js'
import { isPidAlive, runLogPath } from './proc.js'
import { isGuestRunning } from './guest.js'

/** @typedef {{ id: string, ts: string, code: string, severity: string, component: string, title: string, message: string, hint?: string, stack?: string, detail?: string }} DiagnosticRecord */

let catalogCache = null

export function loadDiagnosticsCatalog() {
  if (catalogCache) return catalogCache
  const f = path.join(PKG_ROOT, 'assets', 'diagnostics-catalog.json')
  catalogCache = readJsonFile(f)
  return catalogCache
}

/**
 * @param {string} [stack]
 */
export function diagnosticsLogPath(stack = 'default') {
  return path.join(paths().home, 'diagnostics', `${stack}.jsonl`)
}

/**
 * @param {string} [stack]
 */
export function readDiagnostics(stack = 'default', { limit = 20 } = {}) {
  const f = diagnosticsLogPath(stack)
  if (!fs.existsSync(f)) return []
  const lines = fs.readFileSync(f, 'utf8').trim().split(/\n/).filter(Boolean)
  /** @type {DiagnosticRecord[]} */
  const out = []
  for (const line of lines.slice(-limit)) {
    try {
      out.push(JSON.parse(line))
    } catch {
      /* skip corrupt */
    }
  }
  return out
}

/**
 * Classify free-text error against catalog.
 * @param {string} message
 * @param {{ component?: string }} [ctx]
 */
export function classifyDiagnostic(message, ctx = {}) {
  const cat = loadDiagnosticsCatalog()
  const msg = String(message || '').toLowerCase()
  for (const [code, entry] of Object.entries(cat.codes || {})) {
    if (ctx.component && entry.component !== ctx.component) continue
    for (const needle of entry.match || []) {
      if (msg.includes(String(needle).toLowerCase())) {
        return { code, ...entry }
      }
    }
  }
  const fallback = cat.codes?.['GIM-START-001']
  return {
    code: 'GIM-START-001',
    ...fallback,
    title: fallback?.title || 'Unknown error',
  }
}

/**
 * @param {{
 *   code?: string,
 *   message: string,
 *   stack?: string,
 *   component?: string,
 *   severity?: string,
 *   title?: string,
 *   hint?: string,
 *   detail?: string,
 * }} entry
 */
export function recordDiagnostic(entry) {
  const stack = entry.stack || 'default'
  const classified = entry.code
    ? { code: entry.code, ...(loadDiagnosticsCatalog().codes?.[entry.code] || {}) }
    : classifyDiagnostic(entry.message, { component: entry.component })

  /** @type {DiagnosticRecord} */
  const rec = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    code: classified.code || entry.code || 'GIM-START-001',
    severity: entry.severity || classified.severity || 'error',
    component: entry.component || classified.component || 'unknown',
    title: entry.title || classified.title || 'Error',
    message: String(entry.message || '').slice(0, 2000),
    hint: entry.hint || classified.fix,
    stack,
    detail: entry.detail ? String(entry.detail).slice(0, 4000) : undefined,
  }

  const f = diagnosticsLogPath(stack)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.appendFileSync(f, `${JSON.stringify(rec)}\n`, 'utf8')
  chmodOwnerOnly(f)
  appendLog(`event=diagnostic code=${rec.code} stack=${stack} component=${rec.component}`)
  return rec
}

/**
 * @param {Error & { exitCode?: number }} err
 * @param {{ stack?: string, component?: string, command?: string }} ctx
 */
export function recordError(err, ctx = {}) {
  const message = err?.message || String(err)
  const rec = recordDiagnostic({
    message,
    stack: ctx.stack,
    component: ctx.component,
    detail: ctx.command ? `command=${ctx.command}` : undefined,
  })
  return rec
}

/**
 * @param {string} filePath
 * @param {number} [lines]
 */
export function tailLogFile(filePath, lines = 5) {
  if (!filePath || !fs.existsSync(filePath)) return []
  try {
    const text = fs.readFileSync(filePath, 'utf8')
    return text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .slice(-lines)
  } catch {
    return []
  }
}

/**
 * @param {string} stack
 * @param {{ includeLogs?: boolean }} [opts]
 */
export async function scanStackHealth(stack = 'default', opts = {}) {
  /** @type {{ id: string, ok: boolean, severity: string, code?: string, title: string, detail: string, fix?: string }[]} */
  const checks = []

  function add(id, ok, title, detail, extra = {}) {
    checks.push({
      id,
      ok,
      severity: ok ? 'ok' : extra.severity || 'error',
      title,
      detail,
      code: extra.code,
      fix: extra.fix,
    })
  }

  add('node', nodeOk(), 'Node.js >= 22', hostSummary().node, { severity: 'error', code: 'GIM-CONFIG-001' })

  const engine = detectContainerEngine()
  add(
    'docker',
    engine.ok,
    'Container engine',
    engine.detail,
    {
      severity: 'error',
      code: 'GIM-DOCKER-001',
      fix: loadDiagnosticsCatalog().codes?.['GIM-DOCKER-001']?.fix,
    },
  )

  let cfg = null
  try {
    cfg = readConfig()
    add('config', !!cfg, 'Config', cfg ? paths().config : 'missing — run gim bootstrap', {
      severity: 'error',
      code: 'GIM-CONFIG-001',
    })
  } catch (e) {
    add('config', false, 'Config', String(e.message), { severity: 'error', code: 'GIM-CONFIG-001' })
  }

  if (cfg && !isApiMode(cfg)) {
    const backend = resolveLlmDockerBackend(cfg, {})
    if (backend === 'colibri') {
      const modelPath = resolveColibriModelPath(cfg)
      const model = colibriModelReady(modelPath)
      add('colibri-model', model.ok, 'Colibri model', model.detail, {
        severity: 'error',
        code: 'GIM-COLIBRI-002',
      })
      const eng = colibriNativeEngineReady(undefined, modelPath, { docker: true })
      add('colibri-engine', eng.ok, 'Colibri Docker engine', eng.ok ? eng.artifact : eng.detail, {
        severity: 'error',
        code: 'GIM-COLIBRI-001',
        fix: eng.ok ? undefined : loadDiagnosticsCatalog().codes?.['GIM-COLIBRI-001']?.fix,
      })
    } else if (cfg.gguf) {
      add('gguf', fs.existsSync(cfg.gguf), 'GGUF path', cfg.gguf, {
        severity: 'error',
        code: 'GIM-GGUF-001',
      })
    }
  }

  const run = readRunState(stack)
  if (run) {
    const llmPid = run.pids?.llama || run.pids?.colibri
    add(
      'llm-process',
      !llmPid || isPidAlive(llmPid),
      'LLM process',
      llmPid ? (isPidAlive(llmPid) ? `pid ${llmPid} alive` : `pid ${llmPid} dead`) : 'not started',
      { severity: 'warn', code: 'GIM-LLM-001' },
    )
    if (run.guestSkip) {
      add('guest', false, 'Guest', run.guestSkip, { severity: 'warn', code: 'GIM-GUEST-001' })
    } else if (engine.ok) {
      add('guest', isGuestRunning(stack), 'Guest container', isGuestRunning(stack) ? 'running' : 'stopped', {
        severity: 'warn',
        code: 'GIM-GUEST-001',
      })
    }
    if (run.dshSkip) {
      add('dsh', true, 'DSH', run.dshSkip, { severity: 'ok' })
    }
    if (run.warming) {
      add('warming', false, 'LLM warming', 'still warming — may take minutes on first start', {
        severity: 'warn',
        code: 'GIM-COLIBRI-003',
      })
    }
  } else {
    add('stack', false, 'Stack run state', 'never started or stopped', { severity: 'info' })
  }

  const idx = indexStatus(defaultIndexDir(paths(stack).workspace))
  add(
    'index',
    idx.chunkCount > 0,
    'Code index',
    idx.chunkCount > 0 ? `${idx.chunkCount} chunks` : 'not built',
    { severity: 'info', code: 'GIM-INDEX-001', fix: 'gim index build' },
  )

  const recent = readDiagnostics(stack, { limit: 10 })
  const gpu = detectGpu()

  /** @type {{ path: string, lines: string[] }[]} */
  const logHints = []
  if (opts.includeLogs && run) {
    for (const name of ['colibri', 'llama', 'code-index', 'ui', 'guest']) {
      const p = runLogPath(stack, name)
      const lines = tailLogFile(p, 3)
      if (lines.length) logHints.push({ path: p, lines })
    }
  }

  const failed = checks.filter((c) => !c.ok && c.severity !== 'info')
  return {
    stack,
    active: stackIsActive(stack),
    at: new Date().toISOString(),
    ok: failed.length === 0,
    checks,
    recent,
    gpu: gpu.detail,
    logHints,
  }
}

/**
 * @param {Awaited<ReturnType<typeof scanStackHealth>>} report
 * @param {{ json?: boolean }} [opts]
 */
export function formatDiagnosticReport(report, opts = {}) {
  if (opts.json) return JSON.stringify(report, null, 2)

  const lines = []
  lines.push(`GIM Diagnostics  stack=${report.stack}  active=${report.active}`)
  lines.push(`Host GPU: ${report.gpu || 'n/a'}`)
  lines.push('─'.repeat(52))
  lines.push('HEALTH')
  for (const c of report.checks) {
    const tag = c.ok ? 'OK  ' : c.severity === 'warn' ? 'WARN' : 'FAIL'
    const code = c.code ? ` ${c.code}` : ''
    lines.push(`  [${tag}] ${c.id}${code}`)
    lines.push(`         ${c.title}: ${c.detail}`)
    if (!c.ok && c.fix) lines.push(`         → ${c.fix}`)
  }

  if (report.recent.length) {
    lines.push('─'.repeat(52))
    lines.push('RECENT ERRORS')
    for (const r of report.recent.slice(-5)) {
      lines.push(`  ${r.ts}  ${r.code}  ${r.title}`)
      lines.push(`    ${r.message.slice(0, 120)}${r.message.length > 120 ? '…' : ''}`)
      if (r.hint) lines.push(`    → ${r.hint}`)
    }
  }

  if (report.logHints?.length) {
    lines.push('─'.repeat(52))
    lines.push('LOG TAIL')
    for (const h of report.logHints) {
      lines.push(`  ${h.path}`)
      for (const l of h.lines) lines.push(`    ${l.slice(0, 140)}`)
    }
  }

  lines.push('─'.repeat(52))
  lines.push(`Summary: ${report.ok ? 'no blocking issues detected' : `${report.checks.filter((c) => !c.ok && c.severity === 'error').length} error(s)`}`)
  lines.push('More: gim doctor --speed · gim mcp doctor · gim index sidecar')
  lines.push(`Log: ${diagnosticsLogPath(report.stack)}`)
  return lines.join('\n')
}

export function clearDiagnosticsCatalogCache() {
  catalogCache = null
}
