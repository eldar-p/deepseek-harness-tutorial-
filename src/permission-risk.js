/**
 * Heuristic bash/tool risk tiers (Auto Mode lite).
 * Optional LLM second-pass for `confirm` when GIM_AUTO_MODE=llm (or classifyBashRiskLlm).
 * Inspired by Claude Code yoloClassifier allow/soft_deny split.
 */

/** @typedef {'allow'|'confirm'|'deny'} RiskLevel */
/** @typedef {{ level: RiskLevel, reason: string, source?: 'heuristic'|'llm'|'fallback' }} RiskVerdict */

const DENY_RE = [
  /\brm\s+-[a-z]*r[a-z]*f/i,
  /\brm\s+-rf\b/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bchmod\s+777\b/i,
  /\bchown\s+-R\s+root/i,
  /\bcurl\b.*\|\s*bash/i,
  /\bwget\b.*\|\s*sh/i,
  /\bnpm\s+publish\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  />\s*\/dev\/sd/i,
  /\bdiskpart\b/i,
]

const ALLOW_RE = [
  /^gim\s+(status|doctor|index\s+search|index\s+status|help|presets)\b/i,
  /^node\s+bin\/gim\.js\s+(status|doctor|index\s+search|index\s+status|help|stop)\b/i,
  /^(cat|head|tail|wc|file|stat)\s+/i,
  /^(ls|dir)(\s|$)/i,
  /^pwd\s*$/i,
  /^(grep|rg|findstr)\s+/i,
  /^(echo|printf)\s+/i,
  /^(node|python3?)\s+--version\s*$/i,
  /^(git\s+(status|diff|log|branch|show))\b/i,
  /^(npm\s+(test|run\s+test))\b/i,
]

export const CLASSIFIER_SYSTEM = `You classify shell commands for a coding agent sandbox.
Reply with exactly one word on the first line: ALLOW, CONFIRM, or DENY.
- ALLOW: read-only / safe inspection (ls, cat, git status, tests)
- DENY: destructive or exfiltrating (rm -rf, curl|bash, force push, format disk)
- CONFIRM: installs, network fetch, writes, unclear risk
Second line: short reason (optional).`

/**
 * Classify bash command risk for auto-approve policy (heuristic only).
 * @param {string} command
 * @returns {RiskVerdict}
 */
export function classifyBashRisk(command) {
  const cmd = String(command || '').trim()
  if (!cmd) return { level: 'allow', reason: 'empty', source: 'heuristic' }

  for (const re of DENY_RE) {
    if (re.test(cmd)) return { level: 'deny', reason: re.source.slice(0, 40), source: 'heuristic' }
  }

  const parts = cmd.split(/\s*&&\s*|\s*;\s*|\n/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    for (const re of DENY_RE) {
      if (re.test(part)) return { level: 'deny', reason: `chain: ${re.source.slice(0, 30)}`, source: 'heuristic' }
    }
  }

  if (parts.length === 1 || parts.every((p) => ALLOW_RE.some((re) => re.test(p)))) {
    if (ALLOW_RE.some((re) => re.test(cmd)) || parts.every((p) => ALLOW_RE.some((re) => re.test(p)))) {
      return { level: 'allow', reason: 'read-only or gim meta', source: 'heuristic' }
    }
  }

  if (/\b(curl|wget|fetch)\b/i.test(cmd)) {
    return { level: 'confirm', reason: 'network fetch', source: 'heuristic' }
  }

  if (/\b(npm\s+install|pip\s+install|apt\s+install|docker\s+run)\b/i.test(cmd)) {
    return { level: 'confirm', reason: 'install/run', source: 'heuristic' }
  }

  return { level: 'confirm', reason: 'default', source: 'heuristic' }
}

/** GIM cordis uses approval: never — guard uses deny for destructive only. */
export function shouldDenyBash(command) {
  return classifyBashRisk(command).level === 'deny'
}

const WRITE_DENY_RE = [
  /(^|[/\\])\.env(\.|$)/i,
  /(^|[/\\])id_rsa$/i,
  /(^|[/\\])id_ed25519$/i,
  /\.pem$/i,
  /(^|[/\\])secrets\.json$/i,
  /(^|[/\\])credentials\.json$/i,
  /(^|[/\\])\.git([/\\]|$)/i,
  /(^|[/\\])etc[/\\]passwd$/i,
]

/**
 * Classify Write/Edit path risk (secrets / VCS / system).
 * @param {string} filePath
 * @returns {RiskVerdict}
 */
export function classifyWriteRisk(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/').trim()
  if (!p) return { level: 'allow', reason: 'empty', source: 'heuristic' }
  for (const re of WRITE_DENY_RE) {
    if (re.test(p)) return { level: 'deny', reason: re.source.slice(0, 40), source: 'heuristic' }
  }
  if (/\.(exe|dll|sys|bat|cmd|ps1)$/i.test(p)) {
    return { level: 'confirm', reason: 'binary/script host path', source: 'heuristic' }
  }
  return { level: 'allow', reason: 'workspace write', source: 'heuristic' }
}

export function shouldDenyWrite(filePath) {
  return classifyWriteRisk(filePath).level === 'deny'
}

/**
 * @param {string} text
 * @returns {RiskLevel|null}
 */
export function parseClassifierLabel(text) {
  const line = String(text || '')
    .trim()
    .split(/\r?\n/)[0]
    .trim()
    .toUpperCase()
  if (/^DENY\b/.test(line) || line === 'DENY') return 'deny'
  if (/^ALLOW\b/.test(line) || line === 'ALLOW') return 'allow'
  if (/^CONFIRM\b/.test(line) || line === 'CONFIRM' || /^SOFT_?DENY\b/.test(line)) return 'confirm'
  const m = line.match(/\b(ALLOW|CONFIRM|DENY)\b/)
  if (m) return /** @type {RiskLevel} */ (m[1].toLowerCase())
  return null
}

/**
 * OpenAI-compatible chat completion for risk label.
 * @param {string} command
 * @param {{
 *   baseURL?: string,
 *   model?: string,
 *   apiKey?: string|null,
 *   fetchFn?: typeof fetch,
 *   timeoutMs?: number,
 *   force?: boolean,
 * }} [opts]
 * @returns {Promise<RiskVerdict>}
 */
export async function classifyBashRiskLlm(command, opts = {}) {
  const heuristic = classifyBashRisk(command)
  if (!opts.force && heuristic.level !== 'confirm') {
    return heuristic
  }

  const baseURL = (opts.baseURL || process.env.GIM_CLASSIFIER_URL || 'http://127.0.0.1:8080/v1').replace(
    /\/$/,
    '',
  )
  const model = opts.model || process.env.GIM_CLASSIFIER_MODEL || 'local'
  const apiKey = opts.apiKey ?? process.env.GIM_CLASSIFIER_KEY ?? process.env.GIM_API_KEY ?? null
  const timeoutMs = opts.timeoutMs ?? Number(process.env.GIM_CLASSIFIER_TIMEOUT_MS || 4000)
  const fetchFn = opts.fetchFn || globalThis.fetch

  if (typeof fetchFn !== 'function') {
    return { ...heuristic, source: 'fallback', reason: `${heuristic.reason}; no fetch` }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const headers = { 'content-type': 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    const res = await fetchFn(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 32,
        messages: [
          { role: 'system', content: CLASSIFIER_SYSTEM },
          { role: 'user', content: `Command:\n${String(command || '').slice(0, 2000)}` },
        ],
      }),
    })
    if (!res.ok) {
      return { ...heuristic, source: 'fallback', reason: `${heuristic.reason}; llm http ${res.status}` }
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? ''
    const label = parseClassifierLabel(content)
    if (!label) {
      return { ...heuristic, source: 'fallback', reason: `${heuristic.reason}; llm parse miss` }
    }
    // Never soften a hard heuristic deny when force was used on confirm-only path
    if (heuristic.level === 'deny' && label !== 'deny') {
      return heuristic
    }
    return { level: label, reason: `llm: ${String(content).split(/\r?\n/)[0].slice(0, 80)}`, source: 'llm' }
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'timeout' : e?.message || 'error'
    return { ...heuristic, source: 'fallback', reason: `${heuristic.reason}; llm ${msg}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} command
 * @param {{ mode?: 'heuristic'|'llm', baseURL?: string, model?: string, apiKey?: string|null, fetchFn?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function shouldDenyBashAsync(command, opts = {}) {
  const mode = (opts.mode || process.env.GIM_AUTO_MODE || 'heuristic').toLowerCase()
  if (mode === 'llm' || mode === 'auto') {
    const v = await classifyBashRiskLlm(command, opts)
    return v.level === 'deny'
  }
  return shouldDenyBash(command)
}
