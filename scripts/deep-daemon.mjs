#!/usr/bin/env node
/**
 * Background loop for `deep daemon start`.
 * Usage: node scripts/deep-daemon.mjs --name default --interval 30000
 */
import { appendLog } from '../src/paths.js'
import { daemonTick, writeDaemonState, readDaemonState } from '../src/daemon.js'

function parse(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--name') flags.name = argv[++i]
    else if (a === '--interval') flags.interval = Number(argv[++i])
  }
  return flags
}

const flags = parse(process.argv.slice(2))
const stack = flags.name || 'default'
const interval = Math.max(5000, flags.interval || 30_000)

appendLog(`event=daemon_loop_start stack=${stack} interval=${interval}`)

async function loop() {
  try {
    const summary = await daemonTick(stack)
    const prev = readDaemonState(stack) || {}
    writeDaemonState(stack, {
      ...prev,
      pid: process.pid,
      lastTick: summary,
      intervalMs: interval,
    })
    if (!summary.ok) {
      console.error(`[daemon] unhealthy: ${JSON.stringify(summary.checks)}`)
    } else {
      console.log(`[daemon] ok ${summary.at}`)
    }
  } catch (e) {
    console.error(`[daemon] tick error: ${e.message}`)
  }
}

await loop()
const timer = setInterval(loop, interval)
process.on('SIGTERM', () => {
  clearInterval(timer)
  process.exit(0)
})
process.on('SIGINT', () => {
  clearInterval(timer)
  process.exit(0)
})
