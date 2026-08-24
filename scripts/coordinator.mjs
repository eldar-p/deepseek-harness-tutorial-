#!/usr/bin/env node
/**
 * Lightweight coordinator CLI shim.
 * Prefer: deep coord --task="..."
 */
import { cmdCoord } from '../src/coordinator.js'

function parse(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else {
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          flags[key] = next
          i++
        } else flags[key] = true
      }
    } else positional.push(a)
  }
  return { flags, args: positional }
}

const { flags, args } = parse(process.argv.slice(2))
try {
  await cmdCoord(flags, args)
} catch (e) {
  console.error(e.message)
  process.exit(e.exitCode || 1)
}
