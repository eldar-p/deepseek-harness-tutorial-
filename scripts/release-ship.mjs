#!/usr/bin/env node
/**
 * npm run release:ship — full pre-ship gate (check + honest + egress smoke + e2e if stack up).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function run(script, extraArgs = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...extraArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env },
  })
  return r.status ?? 1
}

let code = run('release-full.mjs')
if (code !== 0) process.exit(code)

code = run('smoke-egress.mjs')
if (code !== 0) process.exit(code)

code = run('smoke-e2e.mjs')
process.exit(code)
