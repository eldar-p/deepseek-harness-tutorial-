#!/usr/bin/env node
/** Coverage gate — beta/pre-beta requires ≥50% line coverage in src/. Override with DEEP_COVERAGE_MIN. */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIN = Number(process.env.DEEP_COVERAGE_MIN || '50')
const TESTS = [
  'test/config.test.js',
  'test/ports.test.js',
  'test/download.test.js',
  'test/paths-guest.test.js',
  'test/status-ui.test.js',
  'test/runstate.test.js',
  'test/detect.test.js',
  'test/quant.test.js',
  'test/io-policy.test.js',
  'test/shutdown.test.js',
  'test/update.test.js',
  'test/readiness.test.js',
  'test/jail.test.js',
  'test/materialize.test.js',
  'test/guest-net.test.js',
]

const r = spawnSync(
  process.execPath,
  ['--test', '--experimental-test-coverage', ...TESTS],
  { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_V8_COVERAGE: path.join(ROOT, '.coverage') } },
)

const out = (r.stdout || '') + (r.stderr || '')
console.log(out)

const srcPcts = []
let inSrc = false
for (const line of out.split('\n')) {
  if (/^\#\s+src\s+\|/.test(line)) {
    inSrc = true
    continue
  }
  if (/^\#\s+test\s+\|/.test(line)) {
    inSrc = false
    continue
  }
  if (inSrc) {
    const m = line.match(/^\#\s+([\w.-]+\.js)\s+\|\s+([\d.]+)/)
    if (m) srcPcts.push(parseFloat(m[2]))
  }
}

const pct =
  srcPcts.length > 0
    ? Math.round((srcPcts.reduce((a, b) => a + b, 0) / srcPcts.length) * 100) / 100
    : NaN

if (Number.isFinite(pct)) {
  console.log(`\nsrc/ coverage: ${pct}% (${srcPcts.length} files, min ${MIN}% for beta)`)
  if (pct < MIN) {
    console.error(`FAIL: src coverage ${pct}% < ${MIN}%`)
    process.exit(1)
  }
} else if (r.status !== 0) {
  process.exit(r.status || 1)
} else {
  console.warn('WARN: could not parse src/ coverage — tests passed')
}
process.exit(0)
