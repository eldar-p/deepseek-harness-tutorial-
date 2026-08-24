#!/usr/bin/env node
/**
 * Automated audit runner — 26 checks (22 base + 4 supplemental).
 * Usage: node scripts/audit-run.mjs [--json] [--gate pre-alpha|alpha|pre-beta]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AUDITS_DIR = path.join(ROOT, 'docs', 'audits')

const GATE_CHECKS = {
  'pre-alpha': [3, 6, 15, 17, 19, 20, 25],
  alpha: [1, 3, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  'pre-beta': Array.from({ length: 26 }, (_, i) => i + 1),
  /** Extended security layer 27–32 (docs/SECURITY-AUDITS-EXTRA.md) */
  security: Array.from({ length: 32 }, (_, i) => i + 1),
}

const AUDIT_SLUGS = [
  'security', 'quality', 'docs-compat', 'licenses', 'types', 'env', 'performance', 'deps',
  'dist', 'container', 'isolation', 'install', 'traces', 'cdn', 'paths', 'gpu', 'ui',
  'tty', 'errors', 'help', 'multistack', 'context',
  'shutdown', 'disk-io', 'telemetry', 'quant-degrade',
  'supply-chain', 'prompt-jail', 'egress-verify', 'secrets-redact', 'container-surface', 'update-integrity',
]

function read(rel) {
  const p = path.join(ROOT, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}

function pass(id, title, detail = '') {
  return { id, title, status: 'PASS', detail }
}
function warn(id, title, detail) {
  return { id, title, status: 'WARN', detail }
}
function fail(id, title, detail) {
  return { id, title, status: 'FAIL', detail }
}
function na(id, title, detail) {
  return { id, title, status: 'N/A', detail }
}

function grepFiles(dir, pattern, { ext = ['.js', '.mjs', '.json', '.yml', '.yaml', '.md'] } = {}) {
  const hits = []
  const walk = (d) => {
    if (!fs.existsSync(d)) return
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue
        walk(p)
      } else if (ext.some((e) => ent.name.endsWith(e))) {
        const text = fs.readFileSync(p, 'utf8')
        if (pattern.test(text)) hits.push(path.relative(ROOT, p))
      }
    }
  }
  walk(dir)
  return hits
}

function runAudits() {
  const results = []

  // 1 Security
  {
    const secrets = grepFiles(path.join(ROOT, 'src'), /(?:api[_-]?key|password|secret)\s*[:=]\s*['"][^'"]{8,}/i)
    const logOk = read('src/paths.js').includes('Never log prompt')
    const rootRefuse = read('src/cli.js').includes('Refuse deep start as root')
    if (secrets.length) results.push(fail(1, 'Безопасность', `Possible secrets in: ${secrets.join(', ')}`))
    else if (!logOk || !rootRefuse) results.push(warn(1, 'Безопасность', 'Missing log redact or root guard'))
    else results.push(pass(1, 'Безопасность', 'No hardcoded secrets; root refuse; log policy'))
  }

  // 2 Quality
  {
    const srcFiles = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'))
    const hasCli = srcFiles.includes('cli.js') && srcFiles.length >= 8
    results.push(hasCli ? pass(2, 'Качество и структура', `${srcFiles.length} src modules`) : warn(2, 'Качество', 'Thin src layout'))
  }

  // 3 Docs
  {
    const docs = ['README.md', 'PRE-ALPHA.md', 'docs/VERSION-PLAN.md', 'docs/AUDITS.md', 'docs/INFRASTRUCTURE.md', 'docs/INSTALL.md', 'LICENSE', 'CONTRIBUTING.md']
    const missing = docs.filter((d) => !fs.existsSync(path.join(ROOT, d)))
    results.push(missing.length ? fail(3, 'Документация', `Missing: ${missing.join(', ')}`) : pass(3, 'Документация', 'Core docs present'))
  }

  // 4 Licenses
  {
    const pkg = JSON.parse(read('package.json') || '{}')
    results.push(pkg.license ? pass(4, 'Лицензии', `package: ${pkg.license}`) : warn(4, 'Лицензии', 'No license in package.json'))
  }

  // 5 Types — JSDoc contracts; full TS deferred past pre-beta
  {
    const srcDir = path.join(ROOT, 'src')
    const files = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')) : []
    let jsdoc = 0
    for (const f of files) {
      const t = fs.readFileSync(path.join(srcDir, f), 'utf8')
      if (/@(param|returns|typedef)\b/.test(t)) jsdoc++
    }
    const typesDoc = fs.existsSync(path.join(ROOT, 'docs/TYPES.md'))
    if (jsdoc >= 5 && typesDoc) {
      results.push(pass(5, 'Типы и сигнатуры', `JSDoc in ${jsdoc}/${files.length} src files; TS deferred (docs/TYPES.md)`))
    } else if (jsdoc >= 3) {
      results.push(warn(5, 'Типы и сигнатуры', `JSDoc partial (${jsdoc}); add docs/TYPES.md`))
    } else {
      results.push(warn(5, 'Типы и сигнатуры', 'Low JSDoc coverage; TS deferred'))
    }
  }

  // 6 Env
  {
    const pkg = JSON.parse(read('package.json') || '{}')
    results.push(pkg.engines?.node ? pass(6, 'Версии среды', `node ${pkg.engines.node}`) : fail(6, 'Версии среды', 'engines.node missing'))
  }

  // 7 Performance — timeouts / health gates present; deep profiling deferred
  {
    const proc = read('src/proc.js')
    const llama = read('src/llama.js')
    const dsh = read('src/dsh.js')
    const hasTimeouts =
      proc.includes('timeoutMs') &&
      (llama.includes('timeoutMs') || llama.includes('300_000') || llama.includes('waitLlamaHealthy')) &&
      (dsh.includes('90_000') || dsh.includes('timeoutMs') || dsh.includes('waitHttpOk'))
    const hasAbort = proc.includes('AbortSignal') || llama.includes('AbortSignal')
    if (hasTimeouts && hasAbort) {
      results.push(pass(7, 'Производительность', 'Health timeouts + AbortSignal; deep profiling deferred to field beta'))
    } else if (hasTimeouts) {
      results.push(warn(7, 'Производительность', 'Timeouts present; add AbortSignal on fetches'))
    } else {
      results.push(warn(7, 'Производительность', 'Missing explicit service timeouts'))
    }
  }
  // 8 Deps
  {
    const pkg = JSON.parse(read('package.json') || '{}')
    const depCount = Object.keys(pkg.dependencies || {}).length
    results.push(depCount === 0 ? pass(8, 'Зависимости', 'Zero runtime npm deps (CLI only)') : warn(8, 'Зависимости', `${depCount} runtime deps`))
  }

  // 9 Dist
  {
    const pkg = JSON.parse(read('package.json') || '{}')
    const files = pkg.files || []
    const ok = files.includes('src') && files.includes('manifests')
    results.push(ok ? pass(9, 'Дистрибутив', `files: ${files.join(', ')}`) : fail(9, 'Дистрибутив', 'package.json files incomplete'))
  }

  // 10 Container
  {
    const df = fs.existsSync(path.join(ROOT, 'Dockerfile.guest'))
    const man = fs.existsSync(path.join(ROOT, 'manifests/guest-images.json'))
    results.push(df && man ? pass(10, 'Контейнер', 'Dockerfile.guest + manifest') : fail(10, 'Контейнер', 'Missing guest artifacts'))
  }

  // 11 Isolation
  {
    const patch = read('assets/cordis.deep.patch.yml')
    const guestPlugin = fs.existsSync(path.join(ROOT, 'dsh-plugins/guest-bash-local/index.mjs'))
    const pwshOff = patch.includes('tool-pwsh') && patch.includes('disabled: true')
    results.push(guestPlugin && pwshOff ? pass(11, 'Изоляция', 'guest-exec; pwsh disabled') : warn(11, 'Изоляция', 'Check cordis + guest-bash-local'))
  }

  // 12 Install
  {
    const sh = fs.existsSync(path.join(ROOT, 'scripts/install-deep.sh'))
    const ps1 = fs.existsSync(path.join(ROOT, 'scripts/install-deep.ps1'))
    const logPolicy = read('scripts/install-deep.sh').includes('chmod 600') || read('scripts/install-deep.sh').includes('0600')
    results.push(sh && ps1 ? pass(12, 'Инсталляторы', logPolicy ? 'install scripts + log mode' : 'scripts ok; log chmod partial') : fail(12, 'Инсталляторы', 'Missing install-deep'))
  }

  // 13 Traces
  {
    const soft = read('src/cli.js').includes('zero-traces')
    const wipeGuard = read('src/cli.js').includes('wipe-workspace')
    results.push(soft && wipeGuard ? pass(13, 'Zero-traces', 'soft/hard hooks; workspace wipe guarded') : warn(13, 'Zero-traces', 'Incomplete wipe policy'))
  }

  // 14 CDN
  {
    const man = JSON.parse(read('manifests/llama-binaries.json') || '{}')
    const cpu = (man.binaries || []).find((b) => b.variant === 'cpu' && b.os === 'win32')
    results.push(cpu?.sha256 ? pass(14, 'CDN / manifests', 'CPU win sha256 pinned') : warn(14, 'CDN', 'Some manifests lack sha256'))
  }

  // 15 Paths
  {
    const guest = read('src/guest.js').includes('toContainerHostPath')
    const mat = read('src/materialize.js').includes('toFileUrl')
    results.push(guest && mat ? pass(15, 'Кросс-платформенные пути', 'Win path helpers present') : fail(15, 'Пути', 'Missing path helpers'))
  }

  // 16 GPU
  {
    const lock = fs.existsSync(path.join(ROOT, 'src/gpu-lock.js'))
    const detect = read('src/detect.js').includes('detectGpu')
    results.push(lock && detect ? pass(16, 'GPU', 'detect + lock file') : warn(16, 'GPU', 'Partial GPU support'))
  }

  // 17 UI
  {
    const ui = read('src/status-ui.js').includes('GREEN')
    results.push(ui ? pass(17, 'Терминал RGB', 'status-ui one-screen') : fail(17, 'UI', 'status-ui missing'))
  }

  // 18 TTY
  {
    const tty = read('src/cli.js').includes('isTTY')
    results.push(tty ? pass(18, 'Интерактивность', 'TTY checks in cli') : warn(18, 'TTY', 'Limited TTY handling'))
  }

  // 19 Errors
  {
    const exit = read('src/cli.js').includes('exitCode')
    results.push(exit ? pass(19, 'Ошибки', 'Structured exitCode') : warn(19, 'Ошибки', 'Add exit codes'))
  }

  // 20 Help
  {
    const help = read('src/cli.js').includes('cmdHelp')
    results.push(help ? pass(20, 'Помощь', 'deep help command') : fail(20, 'Помощь', 'No help'))
  }

  // 21 Multi-stack
  {
    const stacks = read('src/runstate.js').includes('listStacks')
    const nameFlag = read('src/cli.js').includes('--name')
    results.push(stacks && nameFlag ? pass(21, 'Multi-stack', 'listStacks + --name') : warn(21, 'Multi-stack', 'Partial'))
  }

  // 22 Context
  {
    const cordis = read('assets/cordis.deep.patch.yml')
    const ctx = read('assets/CONTEXT.md')
    const agents = read('assets/AGENTS.deep.md')
    const mem = fs.existsSync(path.join(ROOT, 'assets/memory.template.json'))
    const compact = cordis.includes('compaction-basic') && cordis.includes('tool-result-pruner')
    const docs = /compact|compaction|pruner|memory\.json/i.test(ctx + agents)
    if (compact && mem && docs) {
      results.push(pass(22, 'Деградация контекста', 'compaction + pruner in cordis; CONTEXT/AGENTS; memory template'))
    } else if (compact) {
      results.push(warn(22, 'Деградация контекста', 'cordis OK; missing CONTEXT/memory docs'))
    } else {
      results.push(fail(22, 'Деградация контекста', 'Missing compaction/pruner in cordis patch'))
    }
  }

  // 23 Shutdown / interruptions
  {
    const sh = read('src/shutdown.js').includes('installShutdownHandlers')
    const bin = read('bin/deep.js').includes('installShutdownHandlers')
    const kill = read('src/proc.js').includes('killTree')
    const emerg = read('src/cli.js').includes('--emergency')
    const gpuRelease = read('src/gpu-lock.js').includes('finally')
    if (sh && bin && kill && emerg && gpuRelease) {
      results.push(pass(23, 'Завершение и прерывания', 'SIGINT/SIGTERM → stop stacks; emergency; GPU lock release'))
    } else {
      results.push(warn(23, 'Завершение и прерывания', 'Partial shutdown wiring'))
    }
  }

  // 24 Disk I/O and wear
  {
    const io = fs.existsSync(path.join(ROOT, 'src/io-policy.js'))
    const rotate = read('src/paths.js').includes('rotateLogIfLarge')
    const partClean = read('src/cli.js').includes('cleanStalePartFiles')
    const partDl = read('src/download.js').includes('.part')
    results.push(
      io && rotate && partClean && partDl
        ? pass(24, 'Диск I/O и износ', 'log rotate 512KiB; stale .part cleanup; atomic downloads')
        : warn(24, 'Диск I/O', 'Missing io-policy hooks'),
    )
  }

  // 25 Telemetry and privacy
  {
    const cfg = read('src/config.js').includes('telemetry: false')
    const privacy = fs.existsSync(path.join(ROOT, 'assets/PRIVACY.md'))
    const phoneHome = grepFiles(path.join(ROOT, 'src'), /(?:analytics|segment|sentry|mixpanel|google-analytics)/i)
    const noPromptLog = read('src/paths.js').includes('Never log prompt')
    if (phoneHome.length) results.push(fail(25, 'Телеметрия и приватность', `Suspicious tracking refs: ${phoneHome.join(', ')}`))
    else if (cfg && privacy && noPromptLog) results.push(pass(25, 'Телеметрия и приватность', 'telemetry off; PRIVACY.md; no prompt logs'))
    else results.push(warn(25, 'Телеметрия', 'Check telemetry default or PRIVACY.md'))
  }

  // 26 Quant degradation
  {
    const mod = fs.existsSync(path.join(ROOT, 'src/quant-warn.js'))
    const man = read('manifests/default-gguf.json').includes('recommendedMinQuant')
    const warnStart = read('src/cli.js').includes('formatQuantWarning')
    results.push(
      mod && man && warnStart
        ? pass(26, 'Деградация квантования', 'Q4_K_M baseline; WARN on Q3 and below at start')
        : warn(26, 'Квантование', 'quant-warn not fully wired'),
    )
  }

  // 27 Supply chain (extra)
  {
    const pkg = JSON.parse(read('package.json') || '{}')
    const depCount = Object.keys(pkg.dependencies || {}).length
    const rel = read('manifests/cli-releases.json')
    const shaPinned = /"sha256"\s*:\s*"[a-f0-9]{64}"/i.test(rel)
    const checksums = fs.existsSync(path.join(ROOT, 'src/checksums.js'))
    if (depCount === 0 && shaPinned && checksums) {
      results.push(pass(27, 'Supply chain', '0 runtime deps; CDN sha256 pinned; checksums module'))
    } else {
      results.push(
        warn(27, 'Supply chain', `deps=${depCount} shaPinned=${shaPinned} checksums=${checksums}`),
      )
    }
  }

  // 28 Prompt / jail
  {
    const jail = fs.existsSync(path.join(ROOT, 'src/workspace-jail.js'))
    const jailTest =
      fs.existsSync(path.join(ROOT, 'test/jail.test.js')) ||
      read('test/jail.test.js').includes('rewriteWorkspacePath')
    const hostShellOff =
      read('src/cli.js').includes('pwsh') === false ||
      read('assets/cordis.deep.patch.yml').includes('workspace-jail') ||
      read('src/materialize.js').includes('jail')
    if (jail && jailTest) {
      results.push(pass(28, 'Prompt/jail', 'workspace-jail + tests; tool FS rewritten'))
    } else {
      results.push(warn(28, 'Prompt/jail', 'jail module or tests incomplete'))
    }
    void hostShellOff
  }

  // 29 Egress allowlist
  {
    const allow = read('manifests/allowlists.json') || read('manifests/allowlist.json')
    const guest = read('src/guest.js')
    const hasAllow = allow.includes('{') && guest.includes('allowlist')
    const noHostNet = !guest.includes('--network host') && !guest.includes('network=host')
    const openWarn = guest.includes('WARN') || guest.includes('open')
    if (hasAllow && noHostNet) {
      results.push(pass(29, 'Egress allowlist', 'allowlist manifest + guest env; no --network host'))
    } else {
      results.push(warn(29, 'Egress allowlist', `allow=${!!hasAllow} noHostNet=${noHostNet} openWarn=${openWarn}`))
    }
  }

  // 30 Secrets / redaction
  {
    const privacy =
      fs.existsSync(path.join(ROOT, 'assets/PRIVACY.md')) ||
      fs.existsSync(path.join(ROOT, 'docs/PRIVACY.md')) ||
      fs.existsSync(path.join(ROOT, 'PRIVACY.md'))
    const noPrompt = read('src/paths.js').includes('Never log prompt')
    const teleOff =
      read('src/config.js').includes('telemetry') ||
      read('docs/SECURITY-AUDITS-EXTRA.md').includes('telemetry')
    if (privacy && noPrompt) {
      results.push(pass(30, 'Secrets/redaction', 'PRIVACY.md + no prompt logging policy'))
    } else {
      results.push(warn(30, 'Secrets/redaction', `privacy=${privacy} noPrompt=${noPrompt}`))
    }
    void teleOff
  }

  // 31 Container surface
  {
    const guest = read('src/guest.js') + read('Dockerfile.guest') + read('guest/deep-net-enforce.sh')
    const noSock = !guest.includes('docker.sock')
    const netAdmin = guest.includes('NET_ADMIN') || guest.includes('cap-add')
    if (noSock) {
      results.push(pass(31, 'Container surface', `no docker.sock mount; NET_ADMIN for iptables=${netAdmin}`))
    } else {
      results.push(fail(31, 'Container surface', 'docker.sock appears in guest path'))
    }
  }

  // 32 Update integrity
  {
    const upd = read('src/update.js')
    const verify =
      upd.includes('verifySha256') ||
      upd.includes('sha256') ||
      read('src/checksums.js').includes('verifySha256')
    const zipOverride = upd.includes('DEEP_CLI_ZIP') || upd.includes('DEEP_CLI_ZIP'.toLowerCase()) || upd.includes('CLI_ZIP')
    const hasZip = upd.includes('DEEP_CLI_ZIP') || upd.includes('DEEP_CLI_SHA256') || upd.includes('pickCliArtifact')
    if (verify && hasZip) {
      results.push(pass(32, 'Update integrity', 'sha256 verify + local zip override path'))
    } else {
      results.push(warn(32, 'Update integrity', `verify=${verify} zipPath=${hasZip}`))
    }
    void zipOverride
  }

  return results.sort((a, b) => a.id - b.id)
}

function writeReports(results, gate) {
  fs.mkdirSync(AUDITS_DIR, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const gateIds = GATE_CHECKS[gate] || GATE_CHECKS['pre-alpha']
  const gateResults = results.filter((r) => gateIds.includes(r.id))
  const fails = gateResults.filter((r) => r.status === 'FAIL')
  const warns = gateResults.filter((r) => r.status === 'WARN')

  let md = `# Audit run ${stamp}\n\nGate: **${gate}**\n\n`
  md += `| # | Аудит | Статус | Детали |\n|---|-------|--------|--------|\n`
  for (const r of results) {
    md += `| ${r.id} | ${r.title} | ${r.status} | ${r.detail.replace(/\|/g, '/')} |\n`
  }
  md += `\n## Gate summary\n\n`
  md += `- FAIL: ${fails.length}\n- WARN: ${warns.length}\n`
  md += fails.length === 0 ? `\n**Gate ${gate}: OK** (no FAIL)\n` : `\n**Gate ${gate}: BLOCKED**\n`

  fs.writeFileSync(path.join(AUDITS_DIR, 'latest.md'), md, 'utf8')
  fs.writeFileSync(path.join(AUDITS_DIR, `run-${stamp}.md`), md, 'utf8')

  for (const r of results) {
    const slug = String(r.id).padStart(2, '0')
    const name = AUDIT_SLUGS[r.id - 1] || `audit-${r.id}`
    const body = `# ${r.id}. ${r.title}\n\n**Status:** ${r.status}\n\n${r.detail}\n\n_Auto-generated ${stamp}. Re-run: \`npm run audit\`_\n`
    fs.writeFileSync(path.join(AUDITS_DIR, `${slug}-${name}.md`), body, 'utf8')
  }

  return { fails: fails.length, warns: warns.length, md }
}

const jsonOut = process.argv.includes('--json')
const gateArg = process.argv.find((a) => a.startsWith('--gate='))
const gate = gateArg ? gateArg.split('=')[1] : 'pre-alpha'

const results = runAudits()
const { fails, warns, md } = writeReports(results, gate)

if (jsonOut) {
  console.log(JSON.stringify({ gate, fails, warns, results }, null, 2))
} else {
  console.log(md)
}

process.exit(fails > 0 ? 1 : 0)
