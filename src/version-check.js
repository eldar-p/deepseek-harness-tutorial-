import fs from 'node:fs'
import path from 'node:path'
import { which, detectContainerEngine, detectGpu, nodeOk, hostSummary } from './detect.js'
import { paths, PKG_ROOT } from './paths.js'
import { readLocalVersion, getCliReleaseInfo, getChannelRevision } from './update.js'
import { readConfig } from './config.js'

/**
 * Compare semver-ish strings: 1.0.0, 0.9.0-rc.0, 0.5.0-beta
 * @returns {-1|0|1}
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const s = String(v || '0.0.0').replace(/^v/i, '')
    const [core, pre = ''] = s.split('-')
    const parts = core.split('.').map((n) => Number.parseInt(n, 10) || 0)
    while (parts.length < 3) parts.push(0)
    return { parts, pre }
  }
  const A = parse(a)
  const B = parse(b)
  for (let i = 0; i < 3; i++) {
    if (A.parts[i] !== B.parts[i]) return A.parts[i] < B.parts[i] ? -1 : 1
  }
  if (!A.pre && B.pre) return 1
  if (A.pre && !B.pre) return -1
  if (A.pre === B.pre) return 0
  return A.pre < B.pre ? -1 : 1
}

/**
 * @param {string} [channel]
 */
export function assessVersionFreshness(channel) {
  const cfg = readConfig()
  const ch = channel || cfg?.channel || 'stable'
  const local = readLocalVersion()
  const info = getCliReleaseInfo(ch)
  const remote = info?.version || null
  if (!remote) {
    return {
      local,
      remote: null,
      channel: ch,
      status: 'unknown',
      detail: `no CDN version for channel "${ch}" — pin artifacts or use git pull`,
    }
  }
  const cmp = compareVersions(local, remote)
  if (cmp === 0) {
    return { local, remote, channel: ch, status: 'current', detail: 'up to date with channel' }
  }
  if (cmp < 0) {
    return {
      local,
      remote,
      channel: ch,
      status: 'outdated',
      detail: `update available: ${local} → ${remote} (gim update --channel ${ch})`,
    }
  }
  return {
    local,
    remote,
    channel: ch,
    status: 'ahead',
    detail: `local ${local} is newer than channel ${remote}`,
  }
}

function findFileRecursive(root, names) {
  if (!fs.existsSync(root)) return null
  const want = new Set(names.map((n) => n.toLowerCase()))
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let ents
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of ents) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) stack.push(p)
      else if (want.has(ent.name.toLowerCase())) return p
    }
  }
  return null
}

/**
 * @returns {{ ok: boolean, items: { id: string, ok: boolean, required: boolean, detail: string }[] }}
 */
export function checkDependencies() {
  const host = hostSummary()
  const engine = detectContainerEngine()
  const gpu = detectGpu()
  const items = []

  items.push({
    id: 'node',
    ok: nodeOk(),
    required: true,
    detail: `${host.node} ${nodeOk() ? 'OK' : 'NEED >=22'}`,
  })

  items.push({
    id: 'engine',
    ok: !!engine.ok,
    required: true,
    detail: engine.name
      ? `${engine.name} — ${engine.ok ? 'OK' : engine.detail}`
      : 'docker/podman not found',
  })

  const dsh = which('dsh')
  items.push({
    id: 'dsh',
    ok: !!dsh,
    required: false,
    detail: dsh || 'not on PATH (optional until start)',
  })

  let llama = which('llama-server') || null
  if (process.env.GIM_LLAMA_BIN && fs.existsSync(process.env.GIM_LLAMA_BIN)) {
    llama = process.env.GIM_LLAMA_BIN
  }
  if (!llama) {
    const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
    llama = findFileRecursive(paths().runtimeLlama, [exe])
  }
  items.push({
    id: 'llama',
    ok: !!llama,
    required: false,
    detail: llama || 'not found (fetched on start)',
  })

  items.push({
    id: 'gpu',
    ok: true,
    required: false,
    detail: `${gpu.kind} — ${gpu.detail}`,
  })

  const home = paths().home
  let homeOk = true
  let homeDetail = home
  try {
    fs.mkdirSync(home, { recursive: true })
    fs.accessSync(home, fs.constants.W_OK)
  } catch (e) {
    homeOk = false
    homeDetail = `${home} not writable: ${e.message}`
  }
  items.push({
    id: 'home',
    ok: homeOk,
    required: true,
    detail: homeDetail,
  })

  const pkg = path.join(PKG_ROOT, 'package.json')
  items.push({
    id: 'package',
    ok: fs.existsSync(pkg),
    required: true,
    detail: fs.existsSync(pkg) ? PKG_ROOT : 'package root missing',
  })

  const requiredFail = items.some((i) => i.required && !i.ok)
  return { ok: !requiredFail, items }
}

export function cmdVersion(flags = {}) {
  const local = readLocalVersion()
  const fresh = assessVersionFreshness(flags.channel)
  const rev = getChannelRevision(fresh.channel)
  console.log(`GIM CLI ${local}`)
  console.log(`  channel   ${fresh.channel}`)
  console.log(`  revision  ${rev || '—'}`)
  console.log(`  CDN       ${fresh.remote || 'n/a'}`)
  console.log(`  status    ${fresh.status} — ${fresh.detail}`)
  console.log(`  license   Apache-2.0`)
  console.log(`  home      ${paths().home}`)
  if (fresh.status === 'outdated') process.exitCode = 3
}

export function cmdDeps() {
  const r = checkDependencies()
  console.log('GIM dependencies')
  for (const i of r.items) {
    const tag = i.ok ? 'OK  ' : i.required ? 'FAIL' : 'WARN'
    const req = i.required ? 'required' : 'optional'
    console.log(`  ${tag}  ${i.id.padEnd(8)} (${req})  ${i.detail}`)
  }
  console.log(r.ok ? '\n[OK] required dependencies satisfied' : '\n[FAIL] fix required dependencies above')
  if (!r.ok) process.exitCode = 1
}

/** Combined version freshness + deps. */
export function cmdCheck(flags = {}) {
  console.log('GIM check')
  console.log('─'.repeat(48))
  cmdVersion(flags)
  console.log('─'.repeat(48))
  cmdDeps()
}
