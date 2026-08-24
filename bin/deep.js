#!/usr/bin/env node
import { installShutdownHandlers } from '../src/shutdown.js'
import { main } from '../src/cli.js'

installShutdownHandlers()

main(process.argv.slice(2)).catch((err) => {
  console.error(`[FAIL] ${err?.message || err}`)
  process.exit(typeof err?.exitCode === 'number' ? err.exitCode : 1)
})