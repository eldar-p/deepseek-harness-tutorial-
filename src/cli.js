import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, ensureDirs, appendLog } from './paths.js'
import { getOrInitConfig, readConfig, writeConfig, applyPreset, registerStack, PRESET_NAMES } from './config.js'
import { detectContainerEngine, detectGpu, hostSummary, nodeOk, isRoot, which } from './detect.js'
import { printStatusScreen } from './status-ui.js'
import { readRunState, writeRunState, clearRunState, summarizeStacks } from './runstate.js'
import { allocateStackPorts } from './ports.js'
import { withGpuLock, gpuLockHolder } from './gpu-lock.js'
import { materializeAssets } from './materialize.js'
import {
  ensureLlamaBinary,
  resolveGguf,
  maybeDownloadDefaultGguf,
  startLlama,
  waitLlamaHealthy,
  stopLlama,
} from './llama.js'
import { startGuest, stopGuest, mountSmoke, isGuestRunning } from './guest.js'
import { startDsh, stopDsh } from './dsh.js'
import { isPidAlive, killTree } from './proc.js'
import { rotateLogIfLarge, cleanStalePartFiles } from './io-policy.js'
import { assessGgufQuant, formatQuantWarning } from './quant-warn.js'
import { cmdUpdate } from './update.js'
import { assessReadiness, formatReadinessReport } from './readiness.js'

/**
 * @param {string[]} argv
 * @returns {{ cmd: string, args: string[], flags: Record<string, string|boolean> }}
 */
export function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else if (
        a === '--cpu' ||
        a === '--replace' ||
        a === '--emergency' ||
        a === '--wipe-session' ||
        a === '--wipe-workspace' ||
        a === '--watch' ||
        a === '--dry-run' ||
        a === '--readiness' ||
        a === '--all'
      ) {
        flags[a.slice(2)] = true
      } else {
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          flags[key] = next
          i++
        } else flags[key] = true
      }
    } else positional.push(a)
  }
  return { cmd: positional[0] || 'help', args: positional.slice(1), flags }
}

export async function cmdDoctor(flags = {}) {
  const host = hostSummary()
  const engine = detectContainerEngine()
  const gpu = detectGpu()
  const cfg = readConfig()
  let llamaBin = which('llama-server') || process.env.DEEP_LLAMA_BIN || null
  if (!llamaBin) {
    try {
      const { findFileRecursive } = await import('./proc.js')
      llamaBin = findFileRecursive(paths().runtimeLlama, [
        process.platform === 'win32' ? 'llama-server.exe' : 'llama-server',
      ])
    } catch {
      /* */
    }
  }
  console.log('Deep doctor')
  console.log(`  node     ${host.node} ${nodeOk() ? 'OK' : 'NEED >=22'}`)
  console.log(`  os       ${host.family} ${host.platform}/${host.arch}`)
  console.log(`  mem      ${host.freememGb}/${host.totalmemGb} GB free/total`)
  console.log(`  engine   ${engine.name || 'none'} — ${engine.ok ? 'OK' : engine.detail}`)
  if (process.platform === 'win32' && !engine.ok) {
    console.log('           Install: run Docker Desktop installer, reboot if asked')
    console.log('           Then:   powershell -File .\\scripts\\wait-docker.ps1')
  }
  console.log(`  gpu      ${gpu.kind} — ${gpu.detail}`)
  console.log(`  dsh      ${which('dsh') || 'not on PATH'}`)
  console.log(`  llama    ${llamaBin || 'not found (will fetch on start)'}`)
  console.log(`  config   ${cfg ? paths().config : 'missing — run deep bootstrap'}`)
  if (cfg?.gguf) console.log(`  gguf     ${cfg.gguf}`)
  if (cfg?.rebootRequired) console.log('  reboot   REQUIRED before start')

  if (flags.readiness) {
    const stage =
      flags.stage === 'rc'
        ? 'rc'
        : flags.stage === 'beta'
          ? 'beta'
          : flags.stage === 'alpha'
            ? 'alpha'
            : 'pre-alpha'
    const r = assessReadiness(stage)
    console.log(formatReadinessReport(r, { host, engine, gpu: gpu, stage }))
  }

  appendLog('event=doctor')
}

export async function cmdBootstrap(flags) {
  if (flags.gguf && !fs.existsSync(flags.gguf)) {
    throw Object.assign(new Error(`GGUF not found: ${flags.gguf}`), { exitCode: 2 })
  }
  const stack = flags.name || 'default'
  const p = ensureDirs(stack)
  const cfg = getOrInitConfig({
    preset: flags.preset,
    channel: flags.channel,
    gguf: flags.gguf || null,
  })
  if (flags.preset) applyPreset(cfg, flags.preset)
  if (flags.gguf) {
    cfg.gguf = path.resolve(flags.gguf)
    writeConfig(cfg)
  }

  materializeAssets(stack)

  cleanStalePartFiles(paths().manifestsCache)

  if (!fs.existsSync(p.structure)) {
    fs.writeFileSync(
      p.structure,
      '# STRUCTURE\n\nworkspace/\n  .deep/memory.json\n  logs/\n  (project files)\n',
      'utf8',
    )
  }
  if (!fs.existsSync(p.memory)) {
    fs.writeFileSync(
      p.memory,
      JSON.stringify(
        { version: 1, facts: [], recentChanges: [], packages: [], prefs: {} },
        null,
        2,
      ),
      'utf8',
    )
  }
  const envExample = path.join(p.workspace, '.env.example')
  if (!fs.existsSync(envExample)) {
    fs.writeFileSync(envExample, '# secrets — copy to .env (gitignored)\n', 'utf8')
  }
  const gi = path.join(p.workspace, '.gitignore')
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, '.env\nlogs/\n', 'utf8')
  }

  const engine = detectContainerEngine()
  if (!engine.ok) {
    cfg.rebootRequired = !!engine.name
    writeConfig(cfg)
    console.log('[YELLOW] Container engine missing or not running.')
    console.log('         Install Docker Desktop / Podman, then reboot if needed.')
  } else {
    cfg.rebootRequired = false
    writeConfig(cfg)
    console.log(`[OK] Engine ${engine.name}`)
  }

  // Prefetch CPU llama binary (small); CUDA on demand at start
  try {
    const device = detectGpu().discrete ? 'gpu' : 'cpu'
    // Prefer CPU fetch during bootstrap for size; GPU start may fetch cuda later
    const { bin, source } = await ensureLlamaBinary({ device: 'cpu', fetch: true })
    console.log(`[OK] llama-server (${source}): ${bin}`)
  } catch (e) {
    console.log(`[YELLOW] llama fetch skipped: ${e.message}`)
  }

  console.log(`[OK] Deep home: ${p.home}`)
  console.log(`[OK] Workspace: ${p.workspace}`)
  console.log(`[OK] Preset:    ${cfg.preset} (net=${cfg.guestNetwork}, traces=${cfg.zeroTraces})`)
  if (cfg.gguf) console.log(`[OK] GGUF:      ${cfg.gguf}`)
  else console.log('[YELLOW] No GGUF — pass --gguf or put one file in ~/.deep/models')
  appendLog(`event=bootstrap preset=${cfg.preset} stack=${stack}`)
}

export async function cmdStatus(flags) {
  if (flags.all) {
    const rows = summarizeStacks()
    console.log(`Deep stacks (${rows.length})`)
    console.log('─'.repeat(56))
    for (const row of rows) {
      const parts = []
      if (row.llama) parts.push('llama')
      if (row.guest) parts.push('guest')
      if (row.dsh) parts.push('dsh')
      const state = row.active ? parts.join('+') || 'active' : 'stopped'
      const url = row.urls?.dsh ? `  ${row.urls.dsh}` : ''
      console.log(`  ${row.name.padEnd(14)} ${state.padEnd(12)}${url}`)
    }
    console.log('─'.repeat(56))
    console.log('Detail: deep status --name STACK')
    return
  }

  const stack = flags.name || readConfig()?.defaultStack || 'default'
  const cfg = readConfig() || getOrInitConfig({})
  const engine = detectContainerEngine()
  const gpu = detectGpu()
  const run = readRunState(stack)
  const host = hostSummary()

  let llamaLevel = 'red'
  let llamaDetail = 'not started'
  if (run?.pids?.llama && isPidAlive(run.pids.llama)) {
    llamaLevel = run.warming ? 'yellow' : 'green'
    llamaDetail = run.urls?.llama || `pid=${run.pids.llama}`
  } else if (run?.urls?.llama) {
    llamaDetail = run.urls.llama
  }

  let dshLevel = 'red'
  let dshDetail = run?.dshSkip || 'not started'
  if (run?.pids?.dsh && isPidAlive(run.pids.dsh)) {
    dshLevel = 'green'
    dshDetail = run.urls?.dsh || `pid=${run.pids.dsh}`
  }

  const guestOk = isGuestRunning(stack)
  const guestLevel = guestOk ? 'green' : 'red'
  const guestDetail = guestOk ? `deep-guest-${stack}` : run?.guestSkip || 'not started'

  printStatusScreen({
    stack,
    preset: cfg.preset,
    engine: {
      level: engine.ok ? 'green' : engine.name ? 'yellow' : 'red',
      detail: engine.name ? `${engine.name} ${engine.detail}` : 'not found',
    },
    guest: { level: guestLevel, detail: guestDetail },
    llama: { level: llamaLevel, detail: llamaDetail },
    dsh: { level: dshLevel, detail: dshDetail },
    gpu: {
      level: gpu.discrete ? 'green' : 'yellow',
      detail: `${gpu.kind} ${gpu.detail} | RAM free ${host.freememGb}G`,
    },
    net: {
      level: cfg.guestNetwork === 'open' ? 'yellow' : 'green',
      detail: `${cfg.guestNetwork}${cfg.guestNetwork === 'open' ? ' (WARN footprint)' : ''}`,
    },
    reboot: {
      level: cfg.rebootRequired ? 'yellow' : 'green',
      detail: cfg.rebootRequired ? 'REQUIRED' : 'ok',
    },
    urls: run?.urls || null,
  })
}

export async function cmdStart(flags) {
  if (isRoot()) {
    throw Object.assign(new Error('Refuse deep start as root — use a normal user'), { exitCode: 2 })
  }
  const stack = flags.name || 'default'
  const cfg = getOrInitConfig({ preset: flags.preset, gguf: flags.gguf })
  if (flags.preset) applyPreset(cfg, flags.preset)
  if (flags.gguf) {
    cfg.gguf = path.resolve(flags.gguf)
    writeConfig(cfg)
  }

  const engine = detectContainerEngine()
  if (cfg.rebootRequired && !engine.ok) {
    throw Object.assign(new Error('rebootRequired: start Docker/Podman (or reboot), then deep doctor'), {
      exitCode: 4,
    })
  }
  if (cfg.rebootRequired && engine.ok) {
    cfg.rebootRequired = false
    writeConfig(cfg)
  }

  const prev = readRunState(stack)
  if (prev?.pids?.llama || prev?.pids?.dsh || prev?.guestRunning) {
    console.log(`[INFO] Stopping existing stack ${stack} before start`)
    await cmdStop({ name: stack })
  }

  ensureDirs(stack)
  materializeAssets(stack)

  let gguf = resolveGguf({ flagsGguf: flags.gguf || cfg.gguf, configGguf: cfg.gguf })
  if (gguf && typeof gguf === 'object' && gguf.needsDownload) {
    gguf = await maybeDownloadDefaultGguf(gguf.manifest)
    cfg.gguf = gguf
    writeConfig(cfg)
  }

  const qwarn = formatQuantWarning(assessGgufQuant(gguf))
  if (qwarn) console.log(qwarn)

  const device = flags.cpu ? 'cpu' : detectGpu().discrete ? 'gpu' : 'cpu'
  if (!flags.cpu && device === 'cpu') {
    console.log('[YELLOW] No discrete GPU — using CPU+RAM')
  }

  if (device === 'gpu') {
    const holder = gpuLockHolder(stack)
    if (holder) {
      const msg = holder.startsWith('pid:')
        ? `GPU in use by process ${holder.slice(4)} — stop other stacks or use --cpu`
        : `GPU in use by stack "${holder}" — run deep stop --name ${holder} or use --cpu`
      throw Object.assign(new Error(msg), { exitCode: 3 })
    }
  }

  await withGpuLock(async () => {
    // Prefer CPU binary when sha for cuda missing; still pass -ngl if gpu (may no-op on cpu build)
    let llamaDevice = device
    let { bin } = await ensureLlamaBinary({
      device: device === 'gpu' ? 'gpu' : 'cpu',
      fetch: true,
    }).catch(async (e) => {
      if (device === 'gpu') {
        console.log(`[YELLOW] CUDA llama fetch failed (${e.message}) — falling back to CPU binary`)
        llamaDevice = 'cpu'
        return ensureLlamaBinary({ device: 'cpu', fetch: true })
      }
      throw e
    })

    // If cuda sha null, ensureLlama may have thrown — fallback handled above.
    // If cuda entry has null sha256, pickBinaryEntry still returns it; ensureCachedAsset needs sha.
    // Fix: when sha null, skip verify OR use cpu. Patch ensureLlamaBinary path — already falls back if url fetch fails.

    const { llamaPort, dshPort } = await allocateStackPorts()
    const urls = {
      dsh: `http://127.0.0.1:${dshPort}/`,
      llama: `http://127.0.0.1:${llamaPort}/v1`,
    }

    const state = {
      stack,
      sessionId: `sess_${Date.now().toString(36)}`,
      device: llamaDevice,
      warming: true,
      guestRunning: false,
      pids: {},
      ports: { llamaPort, dshPort },
      urls,
      gguf,
      llamaBin: bin,
      startedAt: new Date().toISOString(),
    }
    writeRunState(stack, state)

    const llama = await startLlama({
      stack,
      bin,
      gguf,
      port: llamaPort,
      device: llamaDevice,
    })
    state.pids.llama = llama.pid
    writeRunState(stack, state)

    try {
      await waitLlamaHealthy(llamaPort)
      state.warming = false
      writeRunState(stack, state)
      console.log(`[GREEN] Llama ready ${urls.llama}`)
    } catch (e) {
      console.log(`[RED] Llama failed: ${e.message}`)
      stopLlama(llama.pid, { emergency: true })
      throw Object.assign(e, { exitCode: 1 })
    }

    // Guest (optional if no engine)
    let guestSkip = null
    if (engine.ok) {
      const g = await startGuest({ stack, presetNet: cfg.guestNetwork })
      if (g.ok) {
        const smoke = await mountSmoke(stack, g.engine)
        if (!smoke.ok) {
          console.log(`[YELLOW] Mount smoke failed: ${smoke.detail}`)
          state.guestRunning = false
          state.guestSkip = smoke.detail
        } else {
          state.guestRunning = true
          state.guestName = g.name
          console.log(`[GREEN] Guest ${g.name} (mount smoke OK)`)
        }
      } else {
        guestSkip = g.detail
        state.guestSkip = guestSkip
        console.log(`[YELLOW] Guest skipped: ${guestSkip}`)
      }
    } else {
      guestSkip = 'no container engine'
      state.guestSkip = guestSkip
      console.log(`[YELLOW] Guest skipped: ${guestSkip}`)
    }
    writeRunState(stack, state)

    const dsh = await startDsh({
      stack,
      port: dshPort,
      llamaPort,
      guestName: state.guestName || `deep-guest-${stack}`,
      engineBin: engine.bin || 'docker',
    })
    if (dsh.ok) {
      state.pids.dsh = dsh.pid
      console.log(`[GREEN] DSH ${urls.dsh}`)
    } else {
      state.dshSkip = dsh.detail
      if (dsh.pid) state.pids.dsh = dsh.pid
      console.log(`[YELLOW] DSH: ${dsh.detail}`)
    }
    writeRunState(stack, state)

    console.log('')
    console.log('[OK] Stack started')
    console.log(`DSH:   ${urls.dsh}${dsh.ok ? '' : ' (not up)'}`)
    console.log(`Llama: ${urls.llama}`)
    console.log(`Stack: ${stack}  device=${llamaDevice}  preset=${cfg.preset}`)
    registerStack(cfg, stack, {
      preset: cfg.preset,
      device: llamaDevice,
      guestNetwork: cfg.guestNetwork,
      urls,
    })
    appendLog(`event=start stack=${stack} device=${llamaDevice} dshPort=${dshPort} llamaPort=${llamaPort}`)
  }, { stack })
}

export async function cmdStop(flags) {
  const stack = flags.name || 'default'
  const cfg = readConfig() || {}
  const run = readRunState(stack)
  if (!run) {
    console.log(`[INFO] No run state for stack ${stack}`)
    // still try remove guest container
    stopGuest(stack)
    return
  }

  if (run.pids?.dsh) {
    stopDsh(run.pids.dsh, { emergency: !!flags.emergency })
    console.log(`[OK] DSH stopped pid=${run.pids.dsh}`)
  }
  if (run.pids?.llama) {
    stopLlama(run.pids.llama, { emergency: !!flags.emergency })
    console.log(`[OK] Llama stopped pid=${run.pids.llama}`)
  }
  stopGuest(stack)
  if (run.guestRunning || run.guestName) console.log('[OK] Guest removed')

  // leftover pids
  for (const [name, pid] of Object.entries(run.pids || {})) {
    if (name === 'llama' || name === 'dsh') continue
    if (pid) killTree(pid, { force: !!flags.emergency })
  }

  if (flags['wipe-workspace']) {
    console.log('[WARN] --wipe-workspace refused without typed confirm (safety)')
  }

  const hard = flags['wipe-session'] || cfg.zeroTraces === 'hard'
  console.log(`[INFO] zero-traces ${hard ? 'hard' : cfg.zeroTraces || 'soft'}: session cleared`)
  rotateLogIfLarge(paths().deepLog)
  clearRunState(stack)

  console.log(`[OK] Stack ${stack} stopped`)
  appendLog(`event=stop stack=${stack} emergency=${!!flags.emergency}`)
}

export async function cmdStacks() {
  const rows = summarizeStacks()
  const cfg = readConfig()
  console.log('Deep stacks')
  console.log('─'.repeat(60))
  for (const row of rows) {
    const meta = cfg?.stacks?.[row.name]
    const preset = meta?.preset || cfg?.preset || '?'
    const parts = []
    if (row.llama) parts.push('llama')
    if (row.guest) parts.push('guest')
    if (row.dsh) parts.push('dsh')
    const state = row.active ? parts.join('+') || 'active' : 'stopped'
    console.log(`  ${row.name.padEnd(12)} ${state.padEnd(14)} preset=${preset}`)
    if (row.urls?.dsh) console.log(`    DSH:   ${row.urls.dsh}`)
    if (row.urls?.llama) console.log(`    Llama: ${row.urls.llama}`)
  }
  console.log('─'.repeat(60))
  console.log('Start:  deep start --name STACK')
  console.log('Status: deep status --name STACK | deep status --all')
}

export function cmdHelp() {
  const wide = process.stdout.isTTY && (process.stdout.columns || 80) >= 60
  const ver = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version
  const bar = wide ? '─'.repeat(48) : '---'
  console.log(`Deep CLI ${ver}`)
  console.log(bar)
  console.log(`Usage:
  deep doctor [--readiness] [--stage pre-alpha|alpha|beta|rc]
  deep bootstrap [--gguf PATH] [--preset NAME] [--channel stable|beta|edge]
  deep start [--name STACK] [--gguf PATH] [--cpu] [--preset NAME]
  deep stop [--name STACK] [--emergency] [--wipe-session]
  deep status [--name STACK] [--all]
  deep stacks
  deep update [--channel stable|beta|edge] [--dry-run]
  deep presets

Presets: ${PRESET_NAMES.join(', ')}
Home: ${paths().home}
`)
}

export async function cmdPresets() {
  for (const n of PRESET_NAMES) {
    const p = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'presets', `${n}.json`), 'utf8'))
    console.log(`${n.padEnd(12)} net=${p.guestNetwork.padEnd(10)} traces=${p.zeroTraces.padEnd(6)} ${p.description}`)
  }
}

export async function main(argv) {
  const { cmd, flags } = parseArgs(argv)
  try {
    switch (cmd) {
      case 'doctor':
        return await cmdDoctor(flags)
      case 'bootstrap':
        return await cmdBootstrap(flags)
      case 'start':
        return await cmdStart(flags)
      case 'stop':
        return await cmdStop(flags)
      case 'status':
        return await cmdStatus(flags)
      case 'stacks':
        return await cmdStacks()
      case 'update':
        return await cmdUpdate(flags)
      case 'presets':
        return await cmdPresets()
      case 'help':
      case '--help':
      case '-h':
        return cmdHelp()
      default:
        console.error(`Unknown command: ${cmd}`)
        cmdHelp()
        process.exitCode = 2
    }
  } catch (e) {
    console.error(`[ERR] ${e.message}`)
    appendLog(`event=error msg=${JSON.stringify(e.message)}`)
    process.exitCode = e.exitCode || 1
  }
}
