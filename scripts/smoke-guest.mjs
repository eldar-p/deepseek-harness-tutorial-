#!/usr/bin/env node
/**
 * CI smoke: build guest image + mount smoke (no GGUF / llama / DSH required).
 * Usage: node scripts/smoke-guest.mjs [--stack=ci-smoke]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectContainerEngine } from '../src/detect.js'
import { ensureGuestImage, startGuest, mountSmoke, stopGuest } from '../src/guest.js'
import { paths } from '../src/paths.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const stack = process.argv.find((a) => a.startsWith('--stack='))?.split('=')[1] || 'ci-smoke'

async function main() {
  const engine = detectContainerEngine()
  if (!engine.ok) {
    console.error(`SKIP smoke: ${engine.detail || 'no container engine'}`)
    process.exit(process.env.CI ? 1 : 0)
  }

  const ws = paths(stack).workspace
  fs.mkdirSync(ws, { recursive: true })

  console.log(`[smoke] engine=${engine.name} stack=${stack}`)
  const img = await ensureGuestImage()
  if (!img.ok) {
    console.error(`FAIL image: ${img.reason}`)
    process.exit(1)
  }
  console.log('[smoke] image OK')

  const started = await startGuest({ stack, presetNet: 'offline' })
  if (!started.ok) {
    console.error(`FAIL start: ${started.detail}`)
    process.exit(1)
  }
  console.log('[smoke] guest started')

  const smoke = await mountSmoke(stack, started.engine)
  if (!smoke.ok) {
    console.error(`FAIL mount: ${smoke.detail}`)
    stopGuest(stack, started.engine)
    process.exit(1)
  }
  console.log('[smoke] mount OK')

  stopGuest(stack, started.engine)
  console.log('[smoke] PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
