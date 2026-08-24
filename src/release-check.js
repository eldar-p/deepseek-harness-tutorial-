/**
 * Pre-release gate — readiness RC + audit gates + security eval summary.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { PKG_ROOT } from './paths.js'
import { assessReadiness, formatReadinessReport } from './readiness.js'
import { assessPolicyScore, formatPolicyScoreReport } from './policy-score.js'
import { runSecurityEval, formatSecurityEvalReport } from './security-eval.js'

function runAuditGate(gate) {
  const script = path.join(PKG_ROOT, 'scripts', 'audit-run.mjs')
  const r = spawnSync(process.execPath, [script, `--gate=${gate}`], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim()
  const summary = out.match(/\*\*Gate [^*]+:\s*(OK|BLOCKED)\*\*/)?.[1] || (r.status === 0 ? 'OK' : 'BLOCKED')
  const fails = Number(out.match(/FAIL:\s*(\d+)/)?.[1] ?? (r.status === 0 ? 0 : 1))
  return { gate, ok: r.status === 0 && fails === 0, fails, summary, out: out.split('\n').slice(-6).join('\n') }
}

/**
 * @param {{ host?: object, engine?: object, gpu?: object }} ctx
 */
export function runReleaseCheck(ctx = {}) {
  const readiness = assessReadiness('rc')
  const policy = assessPolicyScore()
  const security = runSecurityEval()
  const audits = [runAuditGate('pre-beta'), runAuditGate('security')]

  const blockers = []
  if (readiness.pct < 88) blockers.push(`readiness rc ${readiness.pct}%`)
  for (const a of audits) {
    if (!a.ok) blockers.push(`audit:${a.gate}`)
  }
  if (!security.ok) blockers.push('security-eval')
  if (policy.grade && policy.grade !== 'A') blockers.push(`policy grade ${policy.grade}`)

  return {
    ok: blockers.length === 0,
    blockers,
    readiness,
    policy,
    security,
    audits,
  }
}

/**
 * @param {ReturnType<typeof runReleaseCheck>} report
 * @param {{ host?: object, engine?: object, gpu?: object }} [ctx]
 */
export function formatReleaseCheckReport(report, ctx = {}) {
  const lines = []
  lines.push(formatReadinessReport(report.readiness, { ...ctx, stage: 'rc' }))
  lines.push('')
  lines.push(formatPolicyScoreReport(report.policy))
  lines.push('')
  for (const a of report.audits) {
    lines.push(`Audit ${a.gate}: ${a.ok ? 'PASS' : 'FAIL'} (${a.summary})`)
    if (!a.ok && a.out) lines.push(a.out)
  }
  lines.push('')
  lines.push(formatSecurityEvalReport(report.security))
  lines.push('─'.repeat(48))
  if (report.ok) {
    lines.push('Release gate: OK — ready to tag')
    lines.push('Next: npm run pack:release · npm run test:coverage · smoke:e2e')
  } else {
    lines.push(`Release gate: BLOCKED — ${report.blockers.join(', ')}`)
  }
  return lines.join('\n')
}
