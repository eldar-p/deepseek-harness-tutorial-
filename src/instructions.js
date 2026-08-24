/**
 * Smart project instructions — .gim/ai-instructions.md
 * AGENTS.md-compatible; progressive disclosure via refresh.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths } from './paths.js'
import { loadEnabledMcpServers } from './mcp-client.js'

const MAX_PROMPT_BYTES = 12_000

/**
 * @param {string} [stack]
 */
export function aiInstructionsPath(stack = 'default') {
  return path.join(paths(stack).workspace, '.gim', 'ai-instructions.md')
}

/**
 * @param {string} [stack]
 */
export function workspaceAgentsPath(stack = 'default') {
  return path.join(paths(stack).workspace, 'AGENTS.md')
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * @param {string} root absolute workspace
 */
export function scanProjectSignals(root) {
  /** @type {{ pm: string|null, scripts: { name: string, cmd: string, run: string }[], ci: string[], langs: string[], name: string|null, description: string|null }} */
  const out = {
    pm: null,
    scripts: [],
    ci: [],
    langs: [],
    name: null,
    description: null,
  }

  const pkgPath = path.join(root, 'package.json')
  const pkg = readJsonSafe(pkgPath)
  if (pkg) {
    out.name = pkg.name || null
    out.description = typeof pkg.description === 'string' ? pkg.description : null
    if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) out.pm = 'pnpm'
    else if (fs.existsSync(path.join(root, 'yarn.lock'))) out.pm = 'yarn'
    else out.pm = 'npm'
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      const priority = ['test', 'lint', 'build', 'start', 'dev', 'check', 'ci']
      const entries = Object.entries(pkg.scripts)
      entries.sort((a, b) => {
        const ai = priority.indexOf(a[0])
        const bi = priority.indexOf(b[0])
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      for (const [name, cmd] of entries.slice(0, 12)) {
        const run =
          out.pm === 'pnpm'
            ? `pnpm ${name === 'test' || name === 'start' || name === 'dev' ? name : `run ${name}`}`
            : out.pm === 'yarn'
              ? `yarn ${name}`
              : `npm run ${name}`
        out.scripts.push({ name, cmd: String(cmd), run })
      }
    }
    out.langs.push('javascript/typescript')
  }

  if (fs.existsSync(path.join(root, 'pyproject.toml'))) {
    out.pm = out.pm || 'uv/pip'
    out.langs.push('python')
    const toml = fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8')
    const m = toml.match(/^\s*name\s*=\s*"([^"]+)"/m)
    if (m) out.name = out.name || m[1]
  }
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
    out.pm = out.pm || 'cargo'
    out.langs.push('rust')
  }
  if (fs.existsSync(path.join(root, 'go.mod'))) {
    out.pm = out.pm || 'go'
    out.langs.push('go')
  }

  const wfDir = path.join(root, '.github', 'workflows')
  if (fs.existsSync(wfDir)) {
    for (const f of fs.readdirSync(wfDir)) {
      if (f.endsWith('.yml') || f.endsWith('.yaml')) out.ci.push(`.github/workflows/${f}`)
    }
  }

  if (fs.existsSync(path.join(root, 'Makefile'))) out.scripts.push({ name: 'make', cmd: 'make', run: 'make' })

  return out
}

/**
 * @param {string} stack
 * @param {ReturnType<typeof scanProjectSignals>} signals
 * @param {{ memoryFacts?: string[], mcpServers?: string[] }} [extra]
 */
export function renderAiInstructions(stack, signals, extra = {}) {
  const title = signals.name || path.basename(paths(stack).workspace)
  const overview =
    signals.description ||
    (signals.name
      ? `Project **${signals.name}** — inspect files before guessing structure.`
      : `Local project workspace for stack \`${stack}\`. Inspect files before guessing structure.`)

  const lines = [
    '# Project instructions (GIM)',
    '',
    '> Auto-maintained baseline — edit freely.',
    '> `gim instructions refresh` updates commands/CI/MCP.',
    '> `gim instructions sync --write-agents` publishes AGENTS.md.',
    '',
    '## Overview',
    '',
    overview,
    '',
  ]

  if (signals.pm || signals.langs.length) {
    lines.push('## Stack', '')
    if (signals.pm) lines.push(`- Package manager: **${signals.pm}**`)
    if (signals.langs.length) lines.push(`- Languages: ${signals.langs.join(', ')}`)
    if (signals.ci.length) lines.push(`- CI: ${signals.ci.join(', ')}`)
    lines.push('')
  }

  lines.push('## Commands', '', '| Task | Command |', '|------|---------|')
  if (signals.scripts.length) {
    for (const s of signals.scripts) {
      lines.push(`| ${s.name} | \`${s.run}\` |`)
    }
  } else {
    lines.push('| test | *(add scripts or run refresh after bootstrap)* |')
  }
  lines.push('')

  lines.push('## Conventions', '')
  lines.push('- Prefer minimal diffs; match existing style')
  lines.push('- Run tests/lint before declaring done')
  lines.push('- Do not commit secrets or echo credentials')
  lines.push('')

  lines.push('## GIM', '')
  lines.push('- Context: `.gim/CONTEXT.md`')
  lines.push('- Memory (user consent only): `.gim/memory.json`')
  lines.push('- Semantic search: `gim index build` then `gim index search`')
  if (extra.mcpServers?.length) {
    lines.push(`- MCP servers: ${extra.mcpServers.join(', ')}`)
  } else {
    lines.push('- MCP: `gim mcp client list`')
  }
  lines.push('')

  if (extra.memoryFacts?.length) {
    lines.push('## Remembered preferences', '')
    for (const f of extra.memoryFacts.slice(0, 8)) lines.push(`- ${f}`)
    lines.push('')
  }

  lines.push('## Security', '')
  lines.push('- Agent shell = **guest container** only (no host bash)')
  lines.push('- Secrets in `.env` / host `~/.gim/secrets.json` — never in prompts')
  lines.push('')

  return lines.join('\n')
}

/**
 * @param {string} [stack]
 * @param {{ force?: boolean }} [opts]
 */
export function initAiInstructions(stack = 'default', opts = {}) {
  const dest = aiInstructionsPath(stack)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (fs.existsSync(dest) && !opts.force) {
    return { ok: true, path: dest, created: false }
  }
  const tpl = path.join(PKG_ROOT, 'assets', 'ai-instructions.template.md')
  if (fs.existsSync(tpl) && !opts.force && !fs.existsSync(dest)) {
    fs.copyFileSync(tpl, dest)
    return { ok: true, path: dest, created: true, source: 'template' }
  }
  const ws = paths(stack).workspace
  const signals = scanProjectSignals(ws)
  const text = renderAiInstructions(stack, signals)
  fs.writeFileSync(dest, text, 'utf8')
  return { ok: true, path: dest, created: true, source: 'generated' }
}

/**
 * @param {string} [stack]
 */
export function refreshAiInstructions(stack = 'default') {
  const dest = aiInstructionsPath(stack)
  const ws = paths(stack).workspace
  const signals = scanProjectSignals(ws)

  /** @type {string[]} */
  const memoryFacts = []
  const mem = readJsonSafe(paths(stack).memory)
  if (mem?.facts && Array.isArray(mem.facts)) {
    for (const f of mem.facts) {
      if (typeof f === 'string' && f.trim()) memoryFacts.push(f.trim())
    }
  }

  const mcpServers = Object.keys(loadEnabledMcpServers())
  const text = renderAiInstructions(stack, signals, { memoryFacts, mcpServers })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, text, 'utf8')
  return {
    ok: true,
    path: dest,
    scriptCount: signals.scripts.length,
    ciCount: signals.ci.length,
    mcpCount: mcpServers.length,
  }
}

/**
 * @param {string} [stack]
 * @param {{ writeAgents?: boolean }} [opts]
 */
export function syncAiInstructions(stack = 'default', opts = {}) {
  if (!fs.existsSync(aiInstructionsPath(stack))) {
    initAiInstructions(stack)
  }
  const refreshed = refreshAiInstructions(stack)
  const agentsPath = workspaceAgentsPath(stack)
  let agentsWritten = false

  if (opts.writeAgents) {
    const body = fs.readFileSync(refreshed.path, 'utf8')
    const header = '<!-- Synced from .gim/ai-instructions.md via gim instructions sync -->\n\n'
    fs.writeFileSync(agentsPath, header + body, 'utf8')
    agentsWritten = true
  } else if (fs.existsSync(agentsPath)) {
    // Preserve human AGENTS.md — append pointer if missing
    const existing = fs.readFileSync(agentsPath, 'utf8')
    if (!existing.includes('ai-instructions.md')) {
      fs.appendFileSync(
        agentsPath,
        '\n\n<!-- GIM canonical instructions: .gim/ai-instructions.md -->\n',
        'utf8',
      )
    }
  }

  return { ...refreshed, agentsPath, agentsWritten }
}

/**
 * Load instructions block for agent system prompt (capped).
 * @param {string} [stack]
 */
export function loadAiInstructionsBlock(stack = 'default') {
  const f = aiInstructionsPath(stack)
  if (!fs.existsSync(f)) return ''
  let text = fs.readFileSync(f, 'utf8').trim()
  if (!text) return ''
  if (Buffer.byteLength(text, 'utf8') > MAX_PROMPT_BYTES) {
    text = text.slice(0, MAX_PROMPT_BYTES)
    text += '\n\n...(truncated — see .gim/ai-instructions.md)'
  }
  return `## Project instructions (.gim/ai-instructions.md)\n\n${text}`
}

/**
 * @param {string} [stack]
 */
export function readAiInstructionsMeta(stack = 'default') {
  const f = aiInstructionsPath(stack)
  if (!fs.existsSync(f)) return { exists: false, path: f }
  const st = fs.statSync(f)
  return {
    exists: true,
    path: f,
    bytes: st.size,
    mtime: st.mtime.toISOString(),
  }
}
