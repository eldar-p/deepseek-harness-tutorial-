#!/usr/bin/env node
import { mainUi } from '../src/ui-server.js'

mainUi(process.argv.slice(2)).catch((err) => {
  console.error(`[FAIL] ${err?.message || err}`)
  process.exit(1)
})
