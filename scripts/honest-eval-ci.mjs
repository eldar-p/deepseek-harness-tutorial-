#!/usr/bin/env node
/**
 * CI wrapper for honest-eval — skips when GIM UI is not running (no false FAIL in nightly).
 * Usage: npm run test:honest
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const UI = process.env.GIM_UI || 'http://127.0.0.1:7545'

async function healthOk() {
  try {
    const res = await fetch(`${UI}/api/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

const ok = await healthOk()
if (!ok) {
  console.log(`SKIP honest-eval: GIM UI not reachable at ${UI}`)
  console.log('Hint: gim start && GIM_UI=<ui-url> npm run test:honest')
  process.exit(process.env.GIM_HONEST_REQUIRED === '1' ? 1 : 0)
}

const script = path.join(ROOT, 'scripts', 'honest-eval.mjs')
const r = spawnSync(process.execPath, [script], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, GIM_UI: UI },
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
