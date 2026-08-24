/**
 * Heuristic bash/tool risk tiers (Auto Mode lite — no extra LLM call).
 * Inspired by Claude Code yoloClassifier allow/soft_deny split; GIM uses regex only.
 */

/** @typedef {'allow'|'confirm'|'deny'} RiskLevel */

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
  /^deep\s+(status|doctor|index\s+search|index\s+status|help|presets)\b/i,
  /^node\s+bin\/deep\.js\s+(status|doctor|index\s+search|index\s+status|help|stop)\b/i,
  /^(cat|head|tail|wc|file|stat)\s+/i,
  /^(ls|dir)(\s|$)/i,
  /^pwd\s*$/i,
  /^(grep|rg|findstr)\s+/i,
  /^(echo|printf)\s+/i,
  /^(node|python3?)\s+--version\s*$/i,
  /^(git\s+(status|diff|log|branch|show))\b/i,
  /^(npm\s+(test|run\s+test))\b/i,
]

/**
 * Classify bash command risk for auto-approve policy.
 * @param {string} command
 * @returns {{ level: RiskLevel, reason: string }}
 */
export function classifyBashRisk(command) {
  const cmd = String(command || '').trim()
  if (!cmd) return { level: 'allow', reason: 'empty' }

  for (const re of DENY_RE) {
    if (re.test(cmd)) return { level: 'deny', reason: re.source.slice(0, 40) }
  }

  // Multi-command chains: deny if any part is deny
  const parts = cmd.split(/\s*&&\s*|\s*;\s*|\n/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    for (const re of DENY_RE) {
      if (re.test(part)) return { level: 'deny', reason: `chain: ${re.source.slice(0, 30)}` }
    }
  }

  if (parts.length === 1 || parts.every((p) => ALLOW_RE.some((re) => re.test(p)))) {
    if (ALLOW_RE.some((re) => re.test(cmd)) || parts.every((p) => ALLOW_RE.some((re) => re.test(p)))) {
      return { level: 'allow', reason: 'read-only or gim meta' }
    }
  }

  // curl/wget outbound from guest — confirm (proxy may apply but still sensitive)
  if (/\b(curl|wget|fetch)\b/i.test(cmd)) {
    return { level: 'confirm', reason: 'network fetch' }
  }

  if (/\b(npm\s+install|pip\s+install|apt\s+install|docker\s+run)\b/i.test(cmd)) {
    return { level: 'confirm', reason: 'install/run' }
  }

  return { level: 'confirm', reason: 'default' }
}

/** GIM cordis uses approval: never — guard uses deny for destructive only. */
export function shouldDenyBash(command) {
  return classifyBashRisk(command).level === 'deny'
}
