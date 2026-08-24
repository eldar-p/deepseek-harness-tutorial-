/** Graceful shutdown on SIGINT/SIGTERM — stop owned stacks, release GPU lock. */
let stopping = false

export function isStopping() {
  return stopping
}

export async function stopAllStacks({ emergency = false } = {}) {
  const { cmdStop } = await import('./cli.js')
  const { listStacks, readRunState } = await import('./runstate.js')
  const stacks = listStacks().filter((s) => {
    const run = readRunState(s)
    return run?.pids?.llama || run?.pids?.dsh || run?.guestRunning
  })
  for (const name of stacks) {
    await cmdStop({ name, emergency })
  }
  return stacks.length
}

export function installShutdownHandlers() {
  if (process.env.DEEP_NO_SIGNAL_HANDLERS === '1') return

  const onSignal = async (sig) => {
    if (stopping) return
    stopping = true
    process.stderr.write(`\n[INFO] ${sig} — graceful stop (use deep stop --emergency if hung)\n`)
    try {
      const n = await stopAllStacks({ emergency: false })
      if (n === 0) process.stderr.write('[INFO] No active stacks\n')
    } catch (e) {
      process.stderr.write(`[WARN] Stop on signal: ${e.message}\n`)
    }
    process.exit(sig === 'SIGINT' ? 130 : 143)
  }

  process.on('SIGINT', () => void onSignal('SIGINT'))
  process.on('SIGTERM', () => void onSignal('SIGTERM'))
}
