import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths } from './paths.js'
import { readConfig } from './config.js'
import { detectContainerEngine, detectGpu, nodeOk, which } from './detect.js'
import { findFileRecursive } from './proc.js'
import { loadManifest } from './download.js'

/** Pre-alpha milestone weights (sum = 100). */
export const PREALPHA_MILESTONES = [
  { id: 'cli', label: 'CLI commands', weight: 10, check: () => fs.existsSync(path.join(PKG_ROOT, 'bin/deep.js')) },
  { id: 'config', label: 'Bootstrap / config', weight: 8, check: () => fs.existsSync(paths().config) },
  {
    id: 'llama-bin',
    label: 'llama-server binary',
    weight: 12,
    check: () => {
      if (which('llama-server') || process.env.DEEP_LLAMA_BIN) return true
      const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
      return !!findFileRecursive(paths().runtimeLlama, [exe])
    },
  },
  {
    id: 'gguf',
    label: 'GGUF configured',
    weight: 10,
    check: () => {
      const cfg = readConfig()
      if (cfg?.gguf && fs.existsSync(cfg.gguf)) return true
      const models = paths().models
      if (!fs.existsSync(models)) return false
      return walkGguf(models).length > 0
    },
  },
  { id: 'llama-run', label: 'Llama spawn tested', weight: 15, check: () => stackWasStarted('llama') },
  { id: 'dsh', label: 'DSH on PATH', weight: 8, check: () => !!which('dsh') },
  { id: 'dsh-run', label: 'DSH spawn tested', weight: 10, check: () => stackWasStarted('dsh') },
  { id: 'guest-engine', label: 'Container engine', weight: 10, check: () => detectContainerEngine().ok },
  {
    id: 'guest-run',
    label: 'Guest container smoke',
    weight: 12,
    check: () => {
      const st = path.join(paths('default').run, 'state.json')
      if (!fs.existsSync(st)) return false
      try {
        const s = JSON.parse(fs.readFileSync(st, 'utf8'))
        return s.guestRunning === true
      } catch {
        return false
      }
    },
  },
  {
    id: 'infra',
    label: 'Infra docs + LICENSE',
    weight: 5,
    check: () =>
      fs.existsSync(path.join(PKG_ROOT, 'LICENSE')) &&
      fs.existsSync(path.join(PKG_ROOT, 'docs/INFRASTRUCTURE.md')),
  },
]

/** Alpha milestone weights (sum = 100). */
export const ALPHA_MILESTONES = [
  {
    id: 'jail',
    label: 'Workspace jail wired',
    weight: 15,
    check: () => cordisIncludes('workspace-jail-fs'),
  },
  {
    id: 'memory',
    label: 'memory.json template',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'assets/memory.template.json')),
  },
  {
    id: 'compact',
    label: 'Compaction + pruner',
    weight: 10,
    check: () => cordisIncludes('compaction-basic') && cordisIncludes('tool-result-pruner'),
  },
  {
    id: 'coverage',
    label: 'Coverage gate ≥30%',
    weight: 10,
    check: () => {
      const gate = fs.readFileSync(path.join(PKG_ROOT, 'scripts/coverage-gate.mjs'), 'utf8')
      return /DEEP_COVERAGE_MIN\s*\|\|\s*['"](?:30|50)['"]/.test(gate)
    },
  },
  {
    id: 'smoke-ci',
    label: 'Guest smoke script',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/smoke-guest.mjs')),
  },
  { id: 'engine', label: 'Container engine', weight: 10, check: () => detectContainerEngine().ok },
  { id: 'guest-run', label: 'Guest smoke on host', weight: 12, check: () => anyStackGuestRunning() },
  {
    id: 'allowlist',
    label: 'Network allowlist manifest',
    weight: 8,
    check: () => {
      const a = loadManifest('allowlists.json')
      return Array.isArray(a.balanced) && a.balanced.length > 0
    },
  },
  {
    id: 'multistack',
    label: 'Multi-stack CLI',
    weight: 10,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'src/cli.js'), 'utf8').includes("case 'stacks'"),
  },
  {
    id: 'audit-alpha',
    label: 'Alpha audit script',
    weight: 5,
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
      return !!pkg.scripts?.['audit:alpha']
    },
  },
]

function cordisIncludes(needle) {
  const p = path.join(PKG_ROOT, 'assets/cordis.deep.patch.yml')
  return fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(needle)
}

function walkGguf(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walkGguf(p))
    else if (ent.name.toLowerCase().endsWith('.gguf')) out.push(p)
  }
  return out
}

function stackWasStarted(which, stack = 'default') {
  const st = path.join(paths(stack).run, 'state.json')
  if (!fs.existsSync(st)) return false
  try {
    const s = JSON.parse(fs.readFileSync(st, 'utf8'))
    if (which === 'llama') return !!s.pids?.llama
    if (which === 'dsh') return !!s.pids?.dsh
    if (which === 'guest') return s.guestRunning === true
  } catch {
    return false
  }
  return false
}

function anyStackGuestRunning() {
  const runRoot = path.join(paths().home, 'run')
  if (!fs.existsSync(runRoot)) return false
  for (const ent of fs.readdirSync(runRoot, { withFileTypes: true })) {
    if (ent.isDirectory() && stackWasStarted('guest', ent.name)) return true
  }
  return stackWasStarted('guest', 'default')
}

function assessMilestones(milestones) {
  const items = milestones.map((m) => {
    let ok = false
    try {
      ok = !!m.check()
    } catch {
      ok = false
    }
    return { ...m, ok, earned: ok ? m.weight : 0 }
  })
  const score = items.reduce((s, i) => s + i.earned, 0)
  const max = items.reduce((s, i) => s + i.weight, 0)
  const pct = Math.round((score / max) * 100)
  let stage = 'early'
  if (pct >= 85) stage = 'complete'
  else if (pct >= 65) stage = 'late'
  else if (pct >= 40) stage = 'mid'
  return { items, score, max, pct, stage }
}

/** Beta milestone weights (sum = 100). */
export const BETA_MILESTONES = [
  {
    id: 'coverage50',
    label: 'Coverage gate ≥50%',
    weight: 12,
    check: () => {
      const gate = fs.readFileSync(path.join(PKG_ROOT, 'scripts/coverage-gate.mjs'), 'utf8')
      return /DEEP_COVERAGE_MIN\s*\|\|\s*['"]50['"]/.test(gate)
    },
  },
  {
    id: 'egress',
    label: 'Guest iptables enforce',
    weight: 12,
    check: () =>
      fs.existsSync(path.join(PKG_ROOT, 'guest/deep-net-enforce.sh')) &&
      fs.readFileSync(path.join(PKG_ROOT, 'Dockerfile.guest'), 'utf8').includes('deep-net-enforce'),
  },
  {
    id: 'context22',
    label: 'Audit #22 context wired',
    weight: 10,
    check: () => {
      const a = fs.readFileSync(path.join(PKG_ROOT, 'scripts/audit-run.mjs'), 'utf8')
      return a.includes('compaction-basic') && a.includes('Деградация контекста')
    },
  },
  {
    id: 'cdn-manifest',
    label: 'CDN artifacts pinned',
    weight: 12,
    check: () => {
      const rel = loadManifest('cli-releases.json')
      const arts = rel.channels?.beta?.cli?.artifacts || []
      return arts.some((x) => x.url && x.sha256 && /^[a-f0-9]{64}$/i.test(x.sha256))
    },
  },
  {
    id: 'cdn-install',
    label: 'CLI install from zip',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'src/cli-install.js')),
  },
  {
    id: 'license',
    label: 'CC BY-NC-SA 4.0',
    weight: 8,
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
      return pkg.license === 'CC-BY-NC-SA-4.0' && fs.readFileSync(path.join(PKG_ROOT, 'LICENSE'), 'utf8').includes('CC-BY-NC-SA-4.0')
    },
  },
  {
    id: 'e2e',
    label: 'smoke:e2e script',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/smoke-e2e.mjs')),
  },
  {
    id: 'pack',
    label: 'pack:release script',
    weight: 8,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/pack-release.mjs')),
  },
  {
    id: 'tty',
    label: 'TTY isTTY in CLI',
    weight: 8,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'src/cli.js'), 'utf8').includes('isTTY'),
  },
  {
    id: 'engine',
    label: 'Container engine',
    weight: 10,
    check: () => detectContainerEngine().ok,
  },
]

export function assessPreAlphaReadiness() {
  return assessMilestones(PREALPHA_MILESTONES)
}

export function assessAlphaReadiness() {
  return assessMilestones(ALPHA_MILESTONES)
}

export function assessBetaReadiness() {
  return assessMilestones(BETA_MILESTONES)
}

/** RC milestone weights (sum = 100). Field beta closed; blockers for release candidate. */
export const RC_MILESTONES = [
  {
    id: 'cov70',
    label: 'Coverage gate ≥70%',
    weight: 12,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'scripts/coverage-gate.mjs'), 'utf8').includes("'70'"),
  },
  {
    id: 'checksums',
    label: 'Checksum sidecars',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'src/checksums.js')),
  },
  {
    id: 'nightly',
    label: 'Nightly CI workflow',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, '.github/workflows/nightly.yml')),
  },
  {
    id: 'gpu-lock',
    label: 'GPU lock module',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'src/gpu-lock.js')),
  },
  {
    id: 'cli-export',
    label: 'parseArgs exported',
    weight: 8,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'src/cli.js'), 'utf8').includes('export function parseArgs'),
  },
  {
    id: 'cdn-sha',
    label: 'Beta CDN sha256 pinned',
    weight: 12,
    check: () => {
      const rel = loadManifest('cli-releases.json')
      const arts = rel.channels?.beta?.cli?.artifacts || []
      return arts.some((x) => x.url && x.sha256 && /^[a-f0-9]{64}$/i.test(x.sha256))
    },
  },
  {
    id: 'prebeta-audit',
    label: 'audit:prebeta script',
    weight: 10,
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
      return !!pkg.scripts?.['audit:prebeta']
    },
  },
  {
    id: 'rc-doc',
    label: 'RC.md status page',
    weight: 8,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'RC.md')),
  },
  {
    id: 'license',
    label: 'CC BY-NC-SA 4.0',
    weight: 10,
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
      return pkg.license === 'CC-BY-NC-SA-4.0'
    },
  },
  {
    id: 'engine',
    label: 'Container engine',
    weight: 10,
    check: () => detectContainerEngine().ok,
  },
]

export function assessRcReadiness() {
  return assessMilestones(RC_MILESTONES)
}

/** 0.5 core freeze milestones (sum = 100). */
export const CORE_MILESTONES = [
  {
    id: 'rc-complete',
    label: 'RC readiness path',
    weight: 12,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'RC.md')),
  },
  {
    id: 'cov70',
    label: 'Coverage gate ≥70%',
    weight: 12,
    check: () => {
      const t = fs.readFileSync(path.join(PKG_ROOT, 'scripts/coverage-gate.mjs'), 'utf8')
      return t.includes("'70'") || t.includes("'75'") || t.includes("'80'") || t.includes("'90'")
    },
  },
  {
    id: 'win-field',
    label: 'Windows field note',
    weight: 10,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'RC.md'), 'utf8').includes('[x] Windows'),
  },
  {
    id: 'proc-http',
    label: 'waitHttpOk covered',
    weight: 10,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'test/proc.test.js'), 'utf8').includes('waitHttpOk'),
  },
  {
    id: 'guest-image',
    label: 'ensureGuestImage tested',
    weight: 10,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'test/guest-net.test.js'), 'utf8').includes('ensureGuestImage'),
  },
  {
    id: 'llama-cache',
    label: 'maybeDownloadDefaultGguf test',
    weight: 10,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'test/llama.test.js'), 'utf8').includes('maybeDownloadDefaultGguf'),
  },
  {
    id: 'cdn',
    label: 'CDN sha256 pinned',
    weight: 12,
    check: () => {
      const rel = loadManifest('cli-releases.json')
      const arts = rel.channels?.beta?.cli?.artifacts || []
      return arts.some((x) => x.url && x.sha256 && /^[a-f0-9]{64}$/i.test(x.sha256))
    },
  },
  {
    id: 'core-doc',
    label: 'CORE.md / 0.5 page',
    weight: 8,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'CORE.md')),
  },
  {
    id: 'license',
    label: 'CC BY-NC-SA 4.0',
    weight: 8,
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
      return pkg.license === 'CC-BY-NC-SA-4.0'
    },
  },
  {
    id: 'engine',
    label: 'Container engine',
    weight: 8,
    check: () => detectContainerEngine().ok,
  },
]

export function assessCoreReadiness() {
  return assessMilestones(CORE_MILESTONES)
}

/** 1.0 product milestones (sum = 100). */
export const V1_MILESTONES = [
  {
    id: 'core',
    label: 'CORE.md present',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'CORE.md')),
  },
  {
    id: 'cov80',
    label: 'Coverage gate ≥80%',
    weight: 12,
    check: () => {
      const t = fs.readFileSync(path.join(PKG_ROOT, 'scripts/coverage-gate.mjs'), 'utf8')
      return t.includes("'80'") || t.includes("'90'") || t.includes("'100'")
    },
  },
  {
    id: 'release-doc',
    label: 'RELEASE.md',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'RELEASE.md')),
  },
  {
    id: 'checksums',
    label: 'Checksum sidecars',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'src/checksums.js')),
  },
  {
    id: 'cdn',
    label: 'CDN sha256 pinned',
    weight: 12,
    check: () => {
      const rel = loadManifest('cli-releases.json')
      const arts = rel.channels?.beta?.cli?.artifacts || []
      return arts.some((x) => x.url && x.sha256 && /^[a-f0-9]{64}$/i.test(x.sha256))
    },
  },
  {
    id: 'update-install',
    label: 'Update install tested',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'test/update-install.test.js')),
  },
  {
    id: 'win-field',
    label: 'Windows field noted',
    weight: 10,
    check: () => fs.readFileSync(path.join(PKG_ROOT, 'RC.md'), 'utf8').includes('[x] Windows'),
  },
  {
    id: 'license',
    label: 'CC BY-NC-SA 4.0',
    weight: 8,
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'))
      return pkg.license === 'CC-BY-NC-SA-4.0'
    },
  },
  {
    id: 'nightly',
    label: 'Nightly CI',
    weight: 8,
    check: () => fs.existsSync(path.join(PKG_ROOT, '.github/workflows/nightly.yml')),
  },
  {
    id: 'engine',
    label: 'Container engine',
    weight: 10,
    check: () => detectContainerEngine().ok,
  },
]

export function assessV1Readiness() {
  return assessMilestones(V1_MILESTONES)
}

/** Post-1.0 hybrid / MCP / auto-mode milestones (sum = 100). */
export const V11_MILESTONES = [
  {
    id: 'v1-base',
    label: '1.0 readiness complete',
    weight: 20,
    check: () => assessV1Readiness().pct >= 85,
  },
  {
    id: 'mcp',
    label: 'MCP server + config',
    weight: 15,
    check: () =>
      fs.existsSync(path.join(PKG_ROOT, 'src/mcp-server.js')) &&
      fs.existsSync(path.join(PKG_ROOT, 'src/mcp-config.js')),
  },
  {
    id: 'tool-search',
    label: 'ToolSearch catalog',
    weight: 12,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'src/tool-search.js')),
  },
  {
    id: 'auto-mode',
    label: 'permission-risk LLM path',
    weight: 12,
    check: () =>
      fs.readFileSync(path.join(PKG_ROOT, 'src/permission-risk.js'), 'utf8').includes('classifyBashRiskLlm'),
  },
  {
    id: 'daemon',
    label: 'daemon + proactive',
    weight: 12,
    check: () =>
      fs.existsSync(path.join(PKG_ROOT, 'src/daemon.js')) &&
      fs.readFileSync(path.join(PKG_ROOT, 'src/daemon.js'), 'utf8').includes('writeProactiveNudge'),
  },
  {
    id: 'coord',
    label: 'coordinator CLI',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'src/coordinator.js')),
  },
  {
    id: 'api-smoke',
    label: 'API smoke script',
    weight: 9,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/smoke-api.mjs')),
  },
  {
    id: 'vulkan',
    label: 'Linux Vulkan pin',
    weight: 10,
    check: () => {
      const man = loadManifest('llama-binaries.json')
      return (man.binaries || []).some((b) => b.os === 'linux' && b.variant === 'vulkan' && b.sha256)
    },
  },
]

export function assessV11Readiness() {
  return assessMilestones(V11_MILESTONES)
}

/** Cross-OS field parity milestones (sum = 100). */
export const FIELD_MILESTONES = [
  {
    id: 'os-compat',
    label: 'OS-COMPAT.md',
    weight: 12,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'docs/OS-COMPAT.md')),
  },
  {
    id: 'field-lite',
    label: 'field-lite.mjs',
    weight: 15,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/field-lite.mjs')),
  },
  {
    id: 'field-linux',
    label: 'field-linux.sh',
    weight: 12,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/field-linux.sh')),
  },
  {
    id: 'field-macos',
    label: 'field-macos.sh',
    weight: 12,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/field-macos.sh')),
  },
  {
    id: 'field-wsl',
    label: 'field-linux-wsl.sh',
    weight: 10,
    check: () => fs.existsSync(path.join(PKG_ROOT, 'scripts/field-linux-wsl.sh')),
  },
  {
    id: 'llama-win',
    label: 'Win llama pin',
    weight: 10,
    check: () => {
      const man = loadManifest('llama-binaries.json')
      return (man.binaries || []).some((b) => b.os === 'win32' && b.sha256)
    },
  },
  {
    id: 'llama-linux',
    label: 'Linux llama pin',
    weight: 10,
    check: () => {
      const man = loadManifest('llama-binaries.json')
      return (man.binaries || []).some((b) => b.os === 'linux' && b.variant === 'cpu' && b.sha256)
    },
  },
  {
    id: 'llama-darwin',
    label: 'Darwin llama pin',
    weight: 10,
    check: () => {
      const man = loadManifest('llama-binaries.json')
      return (man.binaries || []).some((b) => b.os === 'darwin' && b.sha256)
    },
  },
  {
    id: 'linux-vulkan',
    label: 'Linux Vulkan pin',
    weight: 9,
    check: () => {
      const man = loadManifest('llama-binaries.json')
      return (man.binaries || []).some((b) => b.os === 'linux' && b.variant === 'vulkan' && b.sha256)
    },
  },
]

export function assessFieldReadiness() {
  return assessMilestones(FIELD_MILESTONES)
}

export function assessReadiness(stage = 'pre-alpha') {
  if (stage === 'field' || stage === 'os') return assessFieldReadiness()
  if (stage === '1.1' || stage === 'v1.1') return assessV11Readiness()
  if (stage === '1.0' || stage === 'v1') return assessV1Readiness()
  if (stage === '0.5' || stage === 'core') return assessCoreReadiness()
  if (stage === 'rc') return assessRcReadiness()
  if (stage === 'beta') return assessBetaReadiness()
  if (stage === 'alpha') return assessAlphaReadiness()
  return assessPreAlphaReadiness()
}

export function formatReadinessReport(r, { host, engine, gpu, stage = 'pre-alpha' } = {}) {
  const label =
    stage === 'field' || stage === 'os'
      ? 'Field'
      : stage === '1.1' || stage === 'v1.1'
        ? '1.1'
        : stage === '1.0' || stage === 'v1'
          ? '1.0'
          : stage === '0.5' || stage === 'core'
            ? '0.5'
            : stage === 'rc'
              ? 'RC'
              : stage === 'beta'
                ? 'Beta'
                : stage === 'alpha'
                  ? 'Alpha'
                  : 'Pre-alpha'
  const lines = []
  lines.push('')
  lines.push(`${label} readiness: ${r.pct}% (${r.score}/${r.max}) — stage: ${r.stage}`)
  lines.push('─'.repeat(48))
  for (const i of r.items) {
    const tag = i.ok ? 'DONE' : 'TODO'
    lines.push(`  ${tag.padEnd(5)} ${i.label.padEnd(24)} ${i.ok ? i.weight : 0}/${i.weight}`)
  }
  if (r.stage !== 'complete') {
    lines.push('─'.repeat(48))
    const next = r.items.filter((i) => !i.ok).slice(0, 3)
    if (next.length) {
      lines.push('Next:')
      for (const n of next) lines.push(`  • ${n.label}`)
    }
  }
  if (host) lines.push(`\nHost: ${host.platform}/${host.arch}  node=${host.node}  gpu=${gpu?.kind}`)
  if (engine && !engine.ok && stage === 'pre-alpha') {
    lines.push(
      `Hint: install Docker/Podman for guest milestone (+${PREALPHA_MILESTONES.find((m) => m.id === 'guest-run')?.weight || 12}%)`,
    )
  }
  if (engine && !engine.ok && stage === 'alpha') {
    lines.push('Hint: start Docker Desktop for guest + engine milestones')
  }
  return lines.join('\n')
}
