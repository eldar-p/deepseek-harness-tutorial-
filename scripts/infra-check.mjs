#!/usr/bin/env node
/** Infrastructure readiness check — dist, docs, community, legal. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED = [
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'package.json',
  'manifests/channels.json',
  'manifests/cli-releases.json',
  'docs/INFRASTRUCTURE.md',
  'docs/INSTALL.md',
  'docs/ARCHITECTURE.md',
  'docs/TROUBLESHOOTING.md',
  'docs/dist/CHANNELS.md',
  'docs/dist/RELEASE.md',
  'docs/legal/THIRD-PARTY.md',
  'docs/legal/COMMERCIAL-NOTICE.md',
  '.github/workflows/ci.yml',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
]

let fail = 0
console.log('GIM infra check\n')
for (const rel of REQUIRED) {
  const ok = fs.existsSync(path.join(ROOT, rel))
  console.log(`${ok ? 'OK' : 'FAIL'}  ${rel}`)
  if (!ok) fail++
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
if (!pkg.license) {
  console.log('FAIL  package.json license')
  fail++
}

console.log('')
if (fail) {
  console.error(`FAIL: ${fail} missing item(s)`)
  process.exit(1)
}
console.log('OK: infrastructure scaffold complete')
process.exit(0)
