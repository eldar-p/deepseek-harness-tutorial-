#!/usr/bin/env node
/**
 * npm run release:full — RC gate + security + honest eval (pre-ship).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function run(nodeArgs) {
  const r = spawnSync(process.execPath, nodeArgs, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', windowsHide: true })
  return r.status ?? 1
}

let code = run([path.join(ROOT, 'scripts', 'release-check.mjs')])
if (code !== 0) process.exit(code)

code = run([path.join(ROOT, 'scripts', 'honest-eval-ci.mjs')])
process.exit(code)
