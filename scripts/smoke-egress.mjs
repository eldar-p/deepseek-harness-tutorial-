#!/usr/bin/env node
/**
 * Runtime egress smoke — guest with network=none cannot reach external hosts.
 * Usage: node scripts/smoke-egress.mjs [--stack=ci-egress]
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, engineEnv } from '../src/detect.js'
import { ensureGuestImage, startGuest, stopGuest } from '../src/guest.js'
import { paths } from '../src/paths.js'

const stack = process.argv.find((a) => a.startsWith('--stack='))?.split('=')[1] || 'ci-egress'

function guestExec(engineBin, name, cmd) {
  return spawnSync(engineBin, ['exec', name, 'sh', '-c', cmd], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engineBin),
  })
}

async function main() {
  const engine = detectContainerEngine()
  if (!engine.ok) {
    console.error(`SKIP egress smoke: ${engine.detail || 'no container engine'}`)
    process.exit(process.env.CI ? 1 : 0)
  }

  fs.mkdirSync(paths(stack).workspace, { recursive: true })
  console.log(`[egress] engine=${engine.name} stack=${stack}`)

  const img = await ensureGuestImage()
  if (!img.ok) {
    console.error(`FAIL image: ${img.reason}`)
    process.exit(1)
  }

  const started = await startGuest({ stack, presetNet: 'offline' })
  if (!started.ok) {
    console.error(`FAIL start: ${started.detail}`)
    process.exit(1)
  }
  const name = started.name
  const bin = started.engine

  const probe = guestExec(bin, name, 'curl -m 3 -s -o /dev/null -w "%{http_code}" http://1.1.1.1 2>/dev/null || echo blocked')
  const out = String(probe.stdout || probe.stderr || '').trim()
  const blocked = probe.status !== 0 || /blocked|000|fail/i.test(out) || !/^2\d\d$/.test(out)
  if (!blocked) {
    console.error(`FAIL egress: offline guest reached external host (stdout=${out.slice(0, 80)})`)
    stopGuest(stack, bin)
    process.exit(1)
  }
  console.log('[egress] offline guest blocked external HTTP OK')

  const dns = guestExec(bin, name, 'getent hosts example.com >/dev/null 2>&1; echo $?')
  const dnsCode = String(dns.stdout || '').trim()
  if (dnsCode === '0') {
    console.error('FAIL egress: offline guest resolved DNS (network not isolated)')
    stopGuest(stack, bin)
    process.exit(1)
  }
  console.log('[egress] offline guest DNS blocked OK')

  stopGuest(stack, bin)
  console.log('[egress] PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
