#!/usr/bin/env node
/**
 * GIM security eval — adversarial enforcement pack (offline, no LLM/Docker required).
 *
 * Usage:
 *   npm run test:security
 *   gim test security
 *   node scripts/security-eval.mjs [--json]
 *
 * Bar: GIM_SECURITY_BAR (default 0.95) — see docs/SECURITY-EVAL.md
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  runSecurityEval,
  formatSecurityEvalReport,
  SECURITY_EVAL_BAR,
} from '../src/security-eval.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const asJson = process.argv.includes('--json')

const summary = runSecurityEval()

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log('GIM security eval (P6 — enforcement layer)')
  console.log(formatSecurityEvalReport(summary))
}

const outDir = path.join(os.tmpdir(), 'gim-security-eval')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `security-${Date.now()}.json`)
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      bar: SECURITY_EVAL_BAR,
      ...summary,
    },
    null,
    2,
  ),
)
if (!asJson) console.log('saved', outFile)

process.exit(summary.ok ? 0 : 1)
