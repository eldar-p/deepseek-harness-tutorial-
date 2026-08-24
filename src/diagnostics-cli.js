import fs from 'node:fs'
import {
  scanStackHealth,
  formatDiagnosticReport,
  readDiagnostics,
  diagnosticsLogPath,
  recordDiagnostic,
} from './diagnostics.js'
import { assertStackName } from './config.js'

/**
 * @param {object} flags
 */
export async function cmdDiagnose(flags = {}) {
  const stack = assertStackName(flags.name || 'default')
  const includeLogs = flags.logs === true || flags.logs === '' || process.env.GIM_DIAG_LOGS === '1'

  if (flags.clear) {
    const f = diagnosticsLogPath(stack)
    if (fs.existsSync(f)) fs.unlinkSync(f)
    console.log(`[OK] Cleared ${f}`)
    return
  }

  if (flags.last) {
    const n = Number(flags.last) || 10
    const rows = readDiagnostics(stack, { limit: n })
    if (flags.json) {
      console.log(JSON.stringify(rows, null, 2))
      return
    }
    if (!rows.length) {
      console.log(`No diagnostics recorded for stack=${stack}`)
      console.log(`Log path: ${diagnosticsLogPath(stack)}`)
      return
    }
    for (const r of rows) {
      console.log(`${r.ts}  ${r.code}  [${r.severity}] ${r.title}`)
      console.log(`  ${r.message}`)
      if (r.hint) console.log(`  → ${r.hint}`)
    }
    return
  }

  const report = await scanStackHealth(stack, { includeLogs })
  console.log(formatDiagnosticReport(report, { json: flags.json === true || flags.json === '' }))

  if (!report.ok) process.exitCode = 1
}

export { recordDiagnostic, recordError } from './diagnostics.js'
