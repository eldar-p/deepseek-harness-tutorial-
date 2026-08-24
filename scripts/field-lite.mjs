#!/usr/bin/env node
/**
 * Field-lite parity probe (no GGUF / no Docker required).
 * Verifies host tooling + llama binary auto-fetch for this OS.
 *
 * Usage:
 *   node scripts/field-lite.mjs
 *   deep field lite
 *   DEEP_HOME=/tmp/deep-field node scripts/field-lite.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ensureDirs, paths } from '../src/paths.js'
import { ensureLlamaBinary, pickBinaryEntry } from '../src/llama.js'
import { loadManifest } from '../src/download.js'
import { assessPolicyScore } from '../src/policy-score.js'
import { materializeAssets } from '../src/materialize.js'
import { getOrInitConfig } from '../src/config.js'
import { detectContainerEngine, detectGpu, hostSummary, nodeOk } from '../src/detect.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const asJson = process.argv.includes('--json')
const skipFetch = process.argv.includes('--skip-fetch')

if (!process.env.DEEP_HOME) {
  process.env.DEEP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-field-'))
}

/** @type {{ id: string, ok: boolean, detail: string }[]} */
const results = []
function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail: String(detail || '') })
}

const host = hostSummary()
check('node', nodeOk(), host.node)
check('platform', ['win32', 'linux', 'darwin'].includes(host.platform), `${host.platform}/${host.arch}`)

const engine = detectContainerEngine()
check('engine', true, engine.ok ? `${engine.name} OK` : `${engine.detail} (optional for field-lite)`)

const gpu = detectGpu()
check('gpu', true, `${gpu.kind}: ${gpu.detail}`)

const policy = assessPolicyScore()
check('policy', policy.pct >= 90, `grade ${policy.grade} ${policy.pct}%`)

{
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'harness-test-pack.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  check('harness', r.status === 0, `exit ${r.status}`)
}

const man = loadManifest('llama-binaries.json')
const entry = pickBinaryEntry(man, { preferGpu: false })
check(
  'llama-manifest',
  !!(entry?.url && entry?.sha256),
  entry ? `${entry.os}/${entry.arch}/${entry.variant}` : 'missing pin',
)

if (!skipFetch) {
  try {
    const { bin, source, variant } = await ensureLlamaBinary({ device: 'cpu', fetch: true })
    check('llama-fetch', fs.existsSync(bin), `${source} ${variant || ''} ${bin}`)
  } catch (e) {
    check('llama-fetch', false, e.message)
  }
} else {
  check('llama-fetch', true, 'skipped (--skip-fetch)')
}

try {
  ensureDirs('default')
  getOrInitConfig({ preset: 'balanced' })
  materializeAssets('default')
  const p = paths('default')
  const patch2 = path.join(p.dshHome, 'profiles', 'web', 'cordis.patch.yml')
  const ok = fs.existsSync(patch2)
  check('materialize', ok, ok ? 'cordis.patch.yml' : 'cordis.patch.yml missing')
} catch (e) {
  check('materialize', false, e.message)
}

{
  const r = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'deep.js'), 'doctor', '--policy'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, DEEP_NO_BANNER: '1' },
  })
  check('doctor', r.status === 0, `exit ${r.status}`)
}

const failed = results.filter((r) => !r.ok)
const summary = {
  pack: 'field-lite',
  os: `${host.platform}/${host.arch}`,
  deepHome: process.env.DEEP_HOME,
  ok: failed.length === 0,
  passed: results.filter((r) => r.ok).length,
  failed: failed.length,
  total: results.length,
  results,
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(`Deep field-lite (${summary.os})`)
  console.log(`DEEP_HOME=${summary.deepHome}`)
  console.log('─'.repeat(48))
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(16)} ${r.detail}`)
  }
  console.log('─'.repeat(48))
  console.log(`${summary.ok ? 'OK' : 'FAIL'} ${summary.passed}/${summary.total}`)
  console.log('Full stack: scripts/field-linux.sh | field-macos.sh | field-linux-wsl.sh')
}

process.exit(summary.ok ? 0 : 1)
