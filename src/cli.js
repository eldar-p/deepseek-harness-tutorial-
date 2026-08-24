import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, ensureDirs, appendLog } from './paths.js'
import {
  getOrInitConfig,
  readConfig,
  writeConfig,
  applyPreset,
  registerStack,
  PRESET_NAMES,
  assertStackName,
} from './config.js'
import { detectContainerEngine, detectGpu, hostSummary, nodeOk, isRoot, which, isWsl } from './detect.js'
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
import { startGuest, stopGuest, mountSmoke, isGuestRunning, resolveAllowlist } from './guest.js'
import { startDsh, stopDsh } from './dsh.js'
import { isPidAlive, killTree, spawnDetached, runLogPath } from './proc.js'
import { cmdIndexBuild, cmdIndexSearch, cmdIndexStatus } from './code-index-cli.js'
import { ensureSecretsTemplate } from './secrets.js'
import {
  isApiMode,
  resolveApiProfile,
  saveApiToConfig,
  writeApiKeyToDshEnv,
  listApiProviderIds,
} from './api-provider.js'
import { rotateLogIfLarge, cleanStalePartFiles } from './io-policy.js'
import { assessGgufQuant, formatQuantWarning, quantStatusRow, enforceQuantPolicy, writeQuantHintFile } from './quant-warn.js'
import { cmdUpdate } from './update.js'
import { assessReadiness, formatReadinessReport } from './readiness.js'
import { printBanner, maybePrintFirstRunWelcome } from './banner.js'
import { cmdVersion, cmdDeps, cmdCheck } from './version-check.js'
import { cmdLsp } from './lsp-cli.js'
import { cmdDaemon } from './daemon.js'
import { classifyBashRisk, classifyBashRiskLlm, classifyWriteRisk } from './permission-risk.js'
import { assessWorkspaceMemoryBudget } from './memory-budget.js'
import { assessPolicyScore, formatPolicyScoreReport } from './policy-score.js'
import { cmdCoord } from './coordinator.js'
import { validateDeepPlugins, formatPluginValidation } from './plugin-validate.js'
import { resolveDshBin } from './dsh.js'
import { formatMcpConfigHelp } from './mcp-config.js'

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
        a === '--policy' ||
        a === '--skip-fetch' ||
        a === '--all' ||
        a === '--force-quant' ||
        a === '--require-q4'
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
  {
    const apiMode = !!(cfg?.api?.provider)
    const q = quantStatusRow(apiMode ? null : cfg?.gguf, { apiMode })
    console.log(`  quant    ${q.level.toUpperCase()}  ${q.detail}`)
    if (!apiMode && cfg?.gguf) {
      const a = assessGgufQuant(cfg.gguf)
      if (a.tier === 'severe') {
        console.log('  quant    policy  Q2− blocked on start (override: --force-quant)')
      } else if (a.tier === 'degraded' || a.tier === 'acceptable') {
        console.log('  quant    policy  soft WARN; enforce with --require-q4 or DEEP_REQUIRE_Q4=1')
      }
    }
  }
  console.log(formatPluginValidation(validateDeepPlugins()))
  if (isWsl()) {
    const dsh = resolveDshBin()
    if (!dsh) {
      console.log('  wsl      WARN  dsh missing or Windows shim — npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2')
    } else {
      console.log(`  wsl      OK  dsh=${dsh}`)
    }
    if (!engine.ok) {
      console.log('  wsl      WARN  docker not ready — prefer Docker Desktop WSL integration (not apt docker alone)')
    } else {
      console.log('  wsl      OK  container engine')
    }
  }
  if (cfg?.rebootRequired) console.log('  reboot   REQUIRED before start')

  try {
    const stack = assertStackName(flags.name || 'default')
    const mem = assessWorkspaceMemoryBudget(paths(stack))
    if (mem.warns.length) {
      for (const w of mem.warns) console.log(`  memory   WARN ${w}`)
    } else {
      console.log('  memory   OK')
    }
  } catch {
    /* */
  }

  if (flags.readiness) {
    const stage =
      flags.stage === 'field' || flags.stage === 'os'
        ? 'field'
        : flags.stage === '1.1' || flags.stage === 'v1.1'
        ? '1.1'
        : flags.stage === '1.0' || flags.stage === 'v1'
        ? '1.0'
        : flags.stage === '0.5' || flags.stage === 'core'
          ? '0.5'
          : flags.stage === 'rc'
            ? 'rc'
            : flags.stage === 'beta'
              ? 'beta'
              : flags.stage === 'alpha'
                ? 'alpha'
                : 'pre-alpha'
    const r = assessReadiness(stage)
    console.log(formatReadinessReport(r, { host, engine, gpu: gpu, stage }))
  }

  if (flags.policy || flags.readiness) {
    console.log(formatPolicyScoreReport(assessPolicyScore()))
  }

  appendLog('event=doctor')
}

export async function cmdBootstrap(flags) {
  if (flags.gguf && flags.api) {
    throw Object.assign(new Error('Use either --gguf (local model) or --api (cloud), not both'), { exitCode: 2 })
  }
  if (flags.gguf && !fs.existsSync(flags.gguf)) {
    throw Object.assign(new Error(`GGUF not found: ${flags.gguf}`), { exitCode: 2 })
  }
  const stack = assertStackName(flags.name || 'default')
  const p = ensureDirs(stack)
  ensureSecretsTemplate()
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
  if (isApiMode(cfg, flags)) {
    const profile = resolveApiProfile(flags, cfg)
    writeApiKeyToDshEnv(profile)
    saveApiToConfig(cfg, profile)
    writeConfig(cfg)
    console.log(`[OK] API:       ${profile.displayName} → ${profile.model}`)
    console.log(`[OK] API base:  ${profile.baseURL}`)
    console.log(`[INFO] Key env:   ${profile.apiKeyEnv}${profile.apiKey ? ' (set)' : ' — pass --api-key or export env'}`)
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

  // Prefetch CPU llama binary (small); skip when cloud API mode
  if (!isApiMode(cfg, flags)) {
    try {
      const { bin, source } = await ensureLlamaBinary({ device: 'cpu', fetch: true })
      console.log(`[OK] llama-server (${source}): ${bin}`)
    } catch (e) {
      console.log(`[YELLOW] llama fetch skipped: ${e.message}`)
    }
  } else {
    console.log('[INFO] API mode — llama-server not required')
  }

  console.log(`[OK] Deep home: ${p.home}`)
  console.log(`[OK] Workspace: ${p.workspace}`)
  console.log(`[OK] Preset:    ${cfg.preset} (net=${cfg.guestNetwork}, traces=${cfg.zeroTraces})`)
  if (cfg.gguf) console.log(`[OK] GGUF:      ${cfg.gguf}`)
  else if (cfg.api?.provider) console.log(`[OK] API mode:  ${cfg.api.provider} / ${cfg.api.model}`)
  else console.log('[YELLOW] No model — pass --gguf PATH (local) or --api PROVIDER (cloud)')

  const memBudget = assessWorkspaceMemoryBudget(p)
  for (const w of memBudget.warns) console.log(`[YELLOW] Memory: ${w}`)
  if (memBudget.ok && !memBudget.warns.length) console.log('[OK] Memory budget within caps')

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

  const stack = assertStackName(flags.name || readConfig()?.defaultStack || 'default')
  const cfg = readConfig() || getOrInitConfig({})
  const engine = detectContainerEngine()
  const gpu = detectGpu()
  const run = readRunState(stack)
  const host = hostSummary()

  let llamaLevel = 'red'
  let llamaDetail = 'not started'
  if (run?.apiProfile) {
    llamaLevel = 'green'
    llamaDetail = `API ${run.apiProfile.id}/${run.apiProfile.model} @ ${run.apiProfile.baseURL}`
  } else if (run?.pids?.llama && isPidAlive(run.pids.llama)) {
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

  const apiMode = !!(run?.apiProfile || cfg?.api?.provider)
  const quant = quantStatusRow(apiMode ? null : cfg?.gguf, { apiMode })

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
    quant,
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
    apiMode,
  })
}

/** Cloud API stack — no local llama-server or GPU lock. */
async function startStackApi({ stack, cfg, flags, engine }) {
  const profile = resolveApiProfile(flags, cfg)
  if (!profile.apiKey && !process.env[profile.apiKeyEnv]) {
    throw Object.assign(
      new Error(
        `Missing API key for ${profile.apiKeyEnv} — pass --api-key or export ${profile.apiKeyEnv}`,
      ),
      { exitCode: 2 },
    )
  }
  writeApiKeyToDshEnv(profile)
  saveApiToConfig(cfg, profile)
  writeConfig(cfg)

  const { dshPort, indexPort, proxyPort } = await allocateStackPorts()
  const urls = {
    dsh: `http://127.0.0.1:${dshPort}/`,
    llama: profile.baseURL,
    index: `http://127.0.0.1:${indexPort}`,
  }

  const state = {
    stack,
    sessionId: `sess_${Date.now().toString(36)}`,
    device: 'api',
    apiProfile: { id: profile.id, model: profile.model, baseURL: profile.baseURL },
    warming: false,
    guestRunning: false,
    pids: {},
    ports: { dshPort, indexPort, proxyPort },
    urls,
    startedAt: new Date().toISOString(),
  }
  writeRunState(stack, state)

  console.log(`[GREEN] API ${profile.displayName} → ${profile.model}`)
  console.log(`[INFO] Endpoint: ${profile.baseURL}`)

  if (cfg.guestNetwork !== 'none' && cfg.guestNetwork !== 'offline') {
    const allow = resolveAllowlist(cfg.guestNetwork)
    state.pids.proxy = spawnDetached(process.execPath, [path.join(PKG_ROOT, 'scripts', 'deep-services.mjs'), 'egress-proxy'], {
      env: { DEEP_PROXY_PORT: String(proxyPort), DEEP_NET_PRESET: cfg.guestNetwork, DEEP_PROXY_BIND: '0.0.0.0' },
      logFile: runLogPath(stack, 'egress-proxy'),
    })
    console.log(`[GREEN] Egress proxy :${proxyPort} (${allow.length} hosts)`)
  }

  state.pids.index = spawnDetached(process.execPath, [path.join(PKG_ROOT, 'scripts', 'deep-services.mjs'), 'index'], {
    env: {
      DEEP_INDEX_PORT: String(indexPort),
      DEEP_WORKSPACE: paths(stack).workspace,
    },
    logFile: runLogPath(stack, 'code-index'),
  })
  console.log(`[GREEN] Code index ${urls.index}`)

  if (engine.ok) {
    const g = await startGuest({ stack, presetNet: cfg.guestNetwork, proxyPort })
    if (g.ok) {
      const smoke = await mountSmoke(stack, g.engine)
      if (smoke.ok) {
        state.guestRunning = true
        state.guestName = g.name
        console.log(`[GREEN] Guest ${g.name}`)
      } else {
        state.guestSkip = smoke.detail
        console.log(`[YELLOW] Guest mount: ${smoke.detail}`)
      }
    } else {
      state.guestSkip = g.detail
      console.log(`[YELLOW] Guest skipped: ${g.detail}`)
    }
  }
  writeRunState(stack, state)

  const dsh = await startDsh({
    stack,
    port: dshPort,
    apiProfile: profile,
    guestName: state.guestName || `deep-guest-${stack}`,
    engineBin: engine.bin || 'docker',
    indexPort,
  })
  if (dsh.ok) {
    state.pids.dsh = dsh.pid
    console.log(`[GREEN] DSH ${urls.dsh}`)
  } else {
    state.dshSkip = dsh.detail
    console.log(`[YELLOW] DSH: ${dsh.detail}`)
  }
  writeRunState(stack, state)

  console.log('')
  console.log('[OK] Stack started (cloud API mode)')
  console.log(`DSH:   ${urls.dsh}`)
  console.log(`API:   ${profile.id} / ${profile.model}`)
  registerStack(cfg, stack, { preset: cfg.preset, device: 'api', guestNetwork: cfg.guestNetwork, urls })
  appendLog(`event=start_api stack=${stack} provider=${profile.id} model=${profile.model}`)
}

export async function cmdStart(flags) {
  if (isRoot()) {
    throw Object.assign(new Error('Refuse deep start as root — use a normal user'), { exitCode: 2 })
  }
  const stack = assertStackName(flags.name || 'default')
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

  if (flags.gguf && isApiMode(cfg, flags)) {
    throw Object.assign(new Error('Use either --gguf (local) or --api (cloud), not both'), { exitCode: 2 })
  }
  if (isApiMode(cfg, flags)) {
    await startStackApi({ stack, cfg, flags, engine })
    return
  }

  let gguf = resolveGguf({ flagsGguf: flags.gguf || cfg.gguf, configGguf: cfg.gguf })
  if (gguf && typeof gguf === 'object' && gguf.needsDownload) {
    gguf = await maybeDownloadDefaultGguf(gguf.manifest)
    cfg.gguf = gguf
    writeConfig(cfg)
  }

  const assessment = assessGgufQuant(gguf)
  const qwarn = formatQuantWarning(assessment)
  if (qwarn) {
    for (const line of qwarn.split('\n')) console.log(line)
  }
  const policy = enforceQuantPolicy(assessment, flags)
  if (policy.forced) console.log('[YELLOW] Quant policy overridden via --force-quant / DEEP_FORCE_QUANT')

  const deepDir = path.join(paths(stack).workspace, '.deep')
  const hintPath = writeQuantHintFile(deepDir, assessment)
  if (hintPath) console.log(`[INFO] Low-quant agent hints → ${hintPath}`)

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

    const { llamaPort, dshPort, indexPort, proxyPort } = await allocateStackPorts()
    const urls = {
      dsh: `http://127.0.0.1:${dshPort}/`,
      llama: `http://127.0.0.1:${llamaPort}/v1`,
      index: `http://127.0.0.1:${indexPort}`,
    }

    const state = {
      stack,
      sessionId: `sess_${Date.now().toString(36)}`,
      device: llamaDevice,
      warming: true,
      guestRunning: false,
      pids: {},
      ports: { llamaPort, dshPort, indexPort, proxyPort },
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

    // Egress sidecar proxy (host-only secrets; guest uses HTTP_PROXY)
    let proxyPid = null
    if (cfg.guestNetwork !== 'none' && cfg.guestNetwork !== 'offline') {
      const allow = resolveAllowlist(cfg.guestNetwork)
      proxyPid = spawnDetached(process.execPath, [path.join(PKG_ROOT, 'scripts', 'deep-services.mjs'), 'egress-proxy'], {
        env: {
          DEEP_PROXY_PORT: String(proxyPort),
          DEEP_NET_PRESET: cfg.guestNetwork,
          DEEP_PROXY_BIND: '0.0.0.0',
        },
        logFile: runLogPath(stack, 'egress-proxy'),
      })
      state.pids.proxy = proxyPid
      console.log(`[GREEN] Egress proxy :${proxyPort} (${allow.length} hosts, secrets on host)`)
    }

    // Code index HTTP service
    const indexPid = spawnDetached(process.execPath, [path.join(PKG_ROOT, 'scripts', 'deep-services.mjs'), 'index'], {
      env: {
        DEEP_INDEX_PORT: String(indexPort),
        DEEP_WORKSPACE: paths(stack).workspace,
        DEEP_LLAMA_URL: urls.llama,
      },
      logFile: runLogPath(stack, 'code-index'),
    })
    state.pids.index = indexPid
    console.log(`[GREEN] Code index ${urls.index}`)

    // Guest (optional if no engine)
    let guestSkip = null
    if (engine.ok) {
      const g = await startGuest({ stack, presetNet: cfg.guestNetwork, proxyPort })
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
      indexPort,
      apiProfile: null,
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
  const stack = assertStackName(flags.name || 'default')
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
    if (pid) {
      killTree(pid, { force: !!flags.emergency })
      if (name === 'proxy') console.log(`[OK] Egress proxy stopped pid=${pid}`)
      if (name === 'index') console.log(`[OK] Code index stopped pid=${pid}`)
    }
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

export function cmdHelp(topic) {
  printBanner()
  const wide = process.stdout.isTTY && (process.stdout.columns || 80) >= 60
  const ver = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version
  const bar = wide ? '─'.repeat(48) : '---'

  const topics = {
    doctor: `deep doctor [--readiness] [--policy] [--stage pre-alpha|alpha|beta|rc|0.5|1.0|1.1|field]
  Host/engine/GPU probe. --readiness checklist; --policy isolation grade.`,
    test: `deep test harness
  Offline agent harness test pack (jail, risk, MCP, API mock).`,
    field: `deep field lite [--skip-fetch]
  OS field-lite probe: policy, harness, llama CPU fetch, materialize.`,
    bootstrap: `deep bootstrap [--gguf PATH] [--preset NAME] [--channel stable|beta|edge] [--name STACK]
  Create ~/.deep layout, config, workspace seeds.`,
    start: `deep start [--name STACK] [--gguf PATH] [--cpu] [--preset NAME]
           [--require-q4] [--force-quant]
  Start llama + guest + DSH. Stops same stack first if already running.
  Quant: Q2− blocked; --require-q4 enforces Q4_K_M+; --force-quant overrides.`,
    stop: `deep stop [--name STACK] [--emergency] [--wipe-session]
  Stop stack processes. --emergency force-kills.`,
    status: `deep status [--name STACK] [--all]
  One-screen health (Engine/Guest/Llama/DSH/Quant/…).`,
    stacks: `deep stacks
  List registered stacks and run state.`,
    update: `deep update [--channel stable|beta|edge] [--dry-run]
  Sync channel / install CLI zip (CDN or DEEP_CLI_ZIP).`,
    version: `deep version [--channel stable|beta|edge]
  Print local version and CDN freshness.`,
    check: `deep check [--channel …]
  Version freshness + dependency probe.`,
    deps: `deep deps
  Check Node, Docker/Podman, DSH, llama, home writability.`,
    presets: `deep presets
  List built-in presets.`,
    api: `deep api
  List cloud API providers for --api.`,
    index: `deep index build|search|status [--name STACK]
  Semantic code index over the stack workspace.`,
    lsp: `deep lsp servers|query|hover|definition|references|symbols
  Host language-server helpers (typescript-language-server / pyright / …).`,
    daemon: `deep daemon start|stop|status|tick [--name STACK] [--interval MS] [--proactive]
  Background health poller for llama/DSH (Kairos-lite). --proactive writes .deep/PROACTIVE.md.`,
    mcp: `deep mcp | deep mcp config
  Stdio MCP server, or print Cursor MCP JSON snippet.`,
    coord: `deep coord --task="fix A; fix B" [--name STACK] [--workers N]
  Parallel index-search workers (coordinator).`,
    risk: `deep risk classify "bash command" [--llm]
  Heuristic (or optional LLM) auto-mode risk label: allow|confirm|deny.
  Also: deep risk write-path PATH`,
    help: `deep help [command]
  This screen, or details for one command.`,
  }

  if (topic && topics[topic]) {
    console.log(`Deep CLI ${ver} — help: ${topic}`)
    console.log(bar)
    console.log(topics[topic])
    console.log(`\nHome: ${paths().home}`)
    return
  }

  console.log(`Deep CLI ${ver}`)
  console.log(bar)
  console.log(`Usage:
  deep help [command]
  deep version [--channel stable|beta|edge]
  deep check [--channel …]
  deep deps
  deep doctor [--readiness] [--policy] [--stage …]
  deep test harness
  deep field lite
  deep bootstrap [--gguf PATH | --api PROVIDER] [--api-model MODEL] [--api-key KEY] [--preset NAME]
  deep start [--name STACK] [--gguf PATH | --api PROVIDER] [--api-model MODEL] [--api-key KEY] [--cpu] [--preset NAME]
             [--require-q4] [--force-quant]
  deep api
  deep stop [--name STACK] [--emergency] [--wipe-session]
  deep status [--name STACK] [--all]
  deep stacks
  deep update [--channel stable|beta|edge] [--dry-run]
  deep presets
  deep index build|search|status [--name STACK]
  deep lsp servers|query …
  deep daemon start|stop|status|tick [--name STACK] [--proactive]
  deep mcp | deep mcp config
  deep coord --task="fix A; fix B"
  deep risk classify "cmd" [--llm]
  deep risk write-path PATH

Tips:
  First run:  deep doctor && deep bootstrap --gguf MODEL.gguf && deep start
  Cloud:      deep bootstrap --api deepseek --api-key sk-... && deep start --api deepseek
  No banner:  set DEEP_NO_BANNER=1
  Local zip:  set DEEP_CLI_ZIP=path\\to\\deep-cli-*.zip
  MCP:        deep mcp config
  Coordinator: deep coord --task="fix A; fix B"

Presets: ${PRESET_NAMES.join(', ')}
Home: ${paths().home}
`)
  if (topic) {
    console.log(`[HINT] Unknown help topic "${topic}". Try: ${Object.keys(topics).join(', ')}`)
  }
}

export async function cmdPresets() {
  for (const n of PRESET_NAMES) {
    const p = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'presets', `${n}.json`), 'utf8'))
    console.log(`${n.padEnd(12)} net=${p.guestNetwork.padEnd(10)} traces=${p.zeroTraces.padEnd(6)} ${p.description}`)
  }
}

export async function main(argv) {
  const { cmd, args, flags } = parseArgs(argv)
  if (flags.version === true || flags.V === true) {
    return cmdVersion(flags)
  }
  // First-run welcome once (skip bare --version)
  if (!['version', '-V', '--version'].includes(cmd)) {
    maybePrintFirstRunWelcome()
  }
  try {
    switch (cmd) {
      case 'doctor':
        return await cmdDoctor(flags)
      case 'test': {
        const sub = (args[0] || 'harness').toLowerCase()
        if (sub !== 'harness' && sub !== 'pack') {
          console.error('Usage: deep test harness')
          process.exitCode = 2
          return
        }
        const { spawn } = await import('node:child_process')
        const script = path.join(PKG_ROOT, 'scripts', 'harness-test-pack.mjs')
        const child = spawn(process.execPath, [script, ...args.slice(1)], {
          stdio: 'inherit',
          env: process.env,
          cwd: PKG_ROOT,
        })
        await new Promise((resolve, reject) => {
          child.on('error', reject)
          child.on('exit', (code) => {
            process.exitCode = code ?? 0
            resolve()
          })
        })
        return
      }
      case 'field': {
        const sub = (args[0] || 'lite').toLowerCase()
        if (sub !== 'lite') {
          console.error('Usage: deep field lite [--skip-fetch]')
          process.exitCode = 2
          return
        }
        const { spawn } = await import('node:child_process')
        const script = path.join(PKG_ROOT, 'scripts', 'field-lite.mjs')
        const extra = []
        if (flags['skip-fetch'] === true || flags['skip-fetch'] === '') extra.push('--skip-fetch')
        if (flags.json === true || flags.json === '') extra.push('--json')
        const child = spawn(process.execPath, [script, ...extra], {
          stdio: 'inherit',
          env: process.env,
          cwd: PKG_ROOT,
        })
        await new Promise((resolve, reject) => {
          child.on('error', reject)
          child.on('exit', (code) => {
            process.exitCode = code ?? 0
            resolve()
          })
        })
        return
      }
      case 'bootstrap':
        return await cmdBootstrap(flags)
      case 'start': {
        printBanner({ tagline: true })
        return await cmdStart(flags)
      }
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
      case 'api': {
        console.log('Cloud API providers (--api NAME):')
        for (const id of listApiProviderIds()) console.log(`  ${id}`)
        console.log('')
        console.log('Example:')
        console.log('  deep bootstrap --api deepseek --api-model deepseek-chat --api-key sk-...')
        console.log('  deep start --api deepseek')
        return
      }
      case 'index': {
        const sub = args[0]
        const rest = args.slice(1)
        if (sub === 'build') return await cmdIndexBuild(flags)
        if (sub === 'search') return await cmdIndexSearch(flags, rest)
        if (sub === 'status') return await cmdIndexStatus(flags)
        console.error('Usage: deep index build|search|status')
        process.exitCode = 2
        return
      }
      case 'lsp':
        return await cmdLsp(flags, args)
      case 'daemon':
        return await cmdDaemon(flags, args)
      case 'mcp': {
        if ((args[0] || '').toLowerCase() === 'config') {
          console.log(formatMcpConfigHelp())
          return
        }
        const { spawn } = await import('node:child_process')
        const script = path.join(PKG_ROOT, 'scripts', 'deep-mcp.mjs')
        const child = spawn(process.execPath, [script], {
          stdio: 'inherit',
          env: process.env,
        })
        await new Promise((resolve, reject) => {
          child.on('error', reject)
          child.on('exit', (code) => {
            process.exitCode = code ?? 0
            resolve()
          })
        })
        return
      }
      case 'coord':
      case 'coordinator':
        return await cmdCoord(flags, args)
      case 'risk': {
        const sub = args[0]
        if (sub === 'write-path' || sub === 'write') {
          const p = args.slice(1).join(' ').trim()
          if (!p) {
            console.error('Usage: deep risk write-path PATH')
            process.exitCode = 2
            return
          }
          const verdict = classifyWriteRisk(p)
          console.log(`${verdict.level}\tsource=${verdict.source || 'heuristic'}\t${verdict.reason}`)
          return
        }
        const cmdText = args.slice(1).join(' ').trim()
        if (sub !== 'classify' || !cmdText) {
          console.error('Usage: deep risk classify "bash command" [--llm]')
          console.error('       deep risk write-path PATH')
          process.exitCode = 2
          return
        }
        const useLlm = flags.llm === true || flags.llm === ''
        const verdict = useLlm
          ? await classifyBashRiskLlm(cmdText)
          : classifyBashRisk(cmdText)
        console.log(`${verdict.level}\tsource=${verdict.source || 'heuristic'}\t${verdict.reason}`)
        return
      }
      case 'version':
      case '-V':
      case '--version':
        return cmdVersion(flags)
      case 'deps':
      case 'dependencies':
        return cmdDeps()
      case 'check':
        return cmdCheck(flags)
      case 'help':
      case '--help':
      case '-h':
        return cmdHelp(args[0])
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
