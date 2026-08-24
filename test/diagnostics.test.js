import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  classifyDiagnostic,
  recordDiagnostic,
  readDiagnostics,
  diagnosticsLogPath,
  scanStackHealth,
  formatDiagnosticReport,
  clearDiagnosticsCatalogCache,
} from '../src/diagnostics.js'
import { cmdDiagnose } from '../src/diagnostics-cli.js'

test('classifyDiagnostic maps colibri ELF error', () => {
  clearDiagnosticsCatalogCache()
  const c = classifyDiagnostic('Colibri Linux engine deepseek_v4 missing ELF not .exe')
  assert.equal(c.code, 'GIM-COLIBRI-001')
  assert.ok(c.fix)
})

test('classifyDiagnostic maps docker error', () => {
  const c = classifyDiagnostic('Docker not running — Colibri default stack needs Docker')
  assert.equal(c.code, 'GIM-DOCKER-001')
})

test('recordDiagnostic persists jsonl', () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-diag-'))
  process.env.GIM_HOME = home
  clearDiagnosticsCatalogCache()
  try {
    const rec = recordDiagnostic({
      message: 'Docker not running',
      stack: 'utest-diag',
    })
    assert.equal(rec.code, 'GIM-DOCKER-001')
    const rows = readDiagnostics('utest-diag', { limit: 5 })
    assert.equal(rows.length, 1)
    assert.ok(fs.existsSync(diagnosticsLogPath('utest-diag')))
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('scanStackHealth returns checks', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-diag-scan-'))
  process.env.GIM_HOME = home
  clearDiagnosticsCatalogCache()
  try {
    const report = await scanStackHealth('default')
    assert.ok(Array.isArray(report.checks))
    assert.ok(report.checks.some((c) => c.id === 'node'))
    const text = formatDiagnosticReport(report)
    assert.match(text, /GIM Diagnostics/)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('cmdDiagnose --last on empty log', async () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-diag-cmd-'))
  process.env.GIM_HOME = home
  clearDiagnosticsCatalogCache()
  try {
    await cmdDiagnose({ name: 'empty-stack', last: 5 })
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
