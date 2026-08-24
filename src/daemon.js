/**
 * Lightweight stack health daemon (Kairos-lite).
 * Polls llama/DSH URLs; optional proactive nudge file for the agent (GIM_PROACTIVE=1).
 */
import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, appendLog } from './paths.js'
import { readRunState } from './runstate.js'
import { isPidAlive, killTree, spawnDetached, runLogPath } from './proc.js'

export function daemonStatePath(stack = 'default') {
  return path.join(paths(stack).run, 'daemon.json')
}

export function proactivePath(stack = 'default') {
  return path.join(paths(stack).workspace, '.gim', 'PROACTIVE.md')
}

export function readDaemonState(stack = 'default') {
  const f = daemonStatePath(stack)
  if (!fs.existsSync(f)) return null
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

export function writeDaemonState(stack, state) {
  const f = daemonStatePath(stack)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(state, null, 2), 'utf8')
  return state
}

/**
 * Write agent-visible nudge under workspace/.gim/PROACTIVE.md
 * @param {object} summary from daemonTick
 * @param {{ force?: boolean }} [opts]
 */
export function writeProactiveNudge(summary, opts = {}) {
  const enabled =
    opts.force ||
    process.env.GIM_PROACTIVE === '1' ||
    process.env.GIM_PROACTIVE === 'true' ||
    !summary.ok
  if (!enabled) return null

  const failed = (summary.checks || []).filter((c) => !c.ok)
  const lines = [
    `# Proactive tick (${summary.at})`,
    '',
    `Stack: **${summary.stack}** — ${summary.ok ? 'healthy' : 'UNHEALTHY'}`,
    '',
  ]
  if (failed.length) {
    lines.push('Issues:')
    for (const c of failed) lines.push(`- ${c.name}: ${c.detail}`)
    lines.push('', 'Next: `gim status` · `gim start` · `gim daemon tick`')
  } else {
    lines.push('All probes OK. Continue current task; no restart needed.')
  }
  lines.push('')

  const f = proactivePath(summary.stack)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, lines.join('\n'), 'utf8')
  const jsonl = path.join(paths(summary.stack).run, 'proactive.jsonl')
  fs.mkdirSync(path.dirname(jsonl), { recursive: true })
  fs.appendFileSync(jsonl, `${JSON.stringify({ ...summary, nudge: true })}\n`, 'utf8')
  return f
}

/**
 * One health probe against runstate URLs.
 * @param {string} [stack]
 * @param {{ fetchFn?: typeof fetch, timeoutMs?: number, proactive?: boolean }} [opts]
 */
export async function daemonTick(stack = 'default', opts = {}) {
  const run = readRunState(stack)
  const fetchFn = opts.fetchFn || globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? 3000
  const checks = []

  async function probe(name, url) {
    if (!url || typeof fetchFn !== 'function') {
      checks.push({ name, ok: false, detail: 'no url' })
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetchFn(url, { signal: ctrl.signal })
      checks.push({ name, ok: res.ok || res.status < 500, detail: `http ${res.status}` })
    } catch (e) {
      checks.push({ name, ok: false, detail: e?.name === 'AbortError' ? 'timeout' : e?.message || 'fail' })
    } finally {
      clearTimeout(t)
    }
  }

  const llama = run?.urls?.llama
  const dsh = run?.urls?.dsh
  const index = run?.urls?.index
  await probe('llama', llama ? `${String(llama).replace(/\/$/, '')}/health` : null)
  await probe('dsh', dsh || null)
  if (index) await probe('index', `${String(index).replace(/\/$/, '')}/status`)

  /** @type {{ mcpUpdates?: number, mcpSubs?: number }} */
  let mcp = {}
  try {
    const { pollMcpSubscriptionsForAgent, countMcpSubscriptions } = await import('./mcp-subscriptions.js')
    if (countMcpSubscriptions(stack) > 0) {
      const updates = await pollMcpSubscriptionsForAgent(stack)
      mcp = { mcpUpdates: updates.length, mcpSubs: countMcpSubscriptions(stack) }
      if (updates.length) {
        appendLog(`event=daemon_mcp_updates stack=${stack} n=${updates.length}`)
      }
    }
  } catch {
    /* optional */
  }

  const summary = {
    at: new Date().toISOString(),
    stack,
    checks,
    ok: checks.every((c) => c.ok),
    ...mcp,
  }
  appendLog(`event=daemon_tick stack=${stack} ok=${summary.ok}`)
  if (opts.proactive !== false) {
    writeProactiveNudge(summary, { force: opts.proactive === true })
  }
  return summary
}

export async function cmdDaemon(flags = {}, args = []) {
  const stack = flags.name || 'default'
  const sub = (args[0] || 'status').toLowerCase()

  if (sub === 'tick') {
    const summary = await daemonTick(stack, {
      proactive: flags.proactive === true || flags.proactive === '',
    })
    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.ok ? 0 : 1
    return summary
  }

  if (sub === 'status') {
    const st = readDaemonState(stack)
    if (!st?.pid) {
      console.log(`daemon: stopped (${stack})`)
      return
    }
    const alive = isPidAlive(st.pid)
    console.log(`daemon: ${alive ? 'running' : 'dead'} pid=${st.pid} stack=${stack}`)
    if (st.lastTick) console.log(`lastTick: ${st.lastTick.at} ok=${st.lastTick.ok}`)
    if (!alive) process.exitCode = 1
    return
  }

  if (sub === 'stop') {
    const st = readDaemonState(stack)
    if (st?.pid && isPidAlive(st.pid)) {
      killTree(st.pid, { force: true })
      console.log(`Stopped daemon pid=${st.pid}`)
    } else {
      console.log('Daemon not running')
    }
    writeDaemonState(stack, { pid: null, stoppedAt: new Date().toISOString() })
    return
  }

  if (sub === 'start') {
    const existing = readDaemonState(stack)
    if (existing?.pid && isPidAlive(existing.pid)) {
      console.log(`Daemon already running pid=${existing.pid}`)
      return
    }
    const interval = Number(flags.interval || process.env.GIM_DAEMON_INTERVAL_MS || 30_000)
    const logFile = runLogPath(stack, 'daemon')
    const loop = path.join(PKG_ROOT, 'scripts', 'gim-daemon.mjs')
    const wantProactive = flags.proactive === true || flags.proactive === ''
    const pid = spawnDetached(process.execPath, [loop, '--name', stack, '--interval', String(interval)], {
      cwd: PKG_ROOT,
      logFile,
      env: {
        GIM_PROACTIVE: process.env.GIM_PROACTIVE || (wantProactive ? '1' : ''),
      },
    })
    writeDaemonState(stack, {
      pid,
      startedAt: new Date().toISOString(),
      intervalMs: interval,
      logFile,
    })
    console.log(`Daemon started pid=${pid} interval=${interval}ms log=${logFile}`)
    return
  }

  console.error('Usage: gim daemon start|stop|status|tick [--name STACK] [--interval MS] [--proactive]')
  process.exitCode = 2
}
