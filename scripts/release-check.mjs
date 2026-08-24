#!/usr/bin/env node
/**
 * npm run release:check — RC gate + security eval (CI-friendly exit code).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runReleaseCheck, formatReleaseCheckReport } from '../src/release-check.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', windowsHide: true })
  return r.status ?? 1
}

const report = runReleaseCheck()
console.log(formatReleaseCheckReport(report))
if (!report.ok) process.exit(1)

const sec = run(process.execPath, [path.join(ROOT, 'scripts', 'security-eval.mjs')])
process.exit(sec)
