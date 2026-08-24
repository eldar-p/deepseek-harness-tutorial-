/** Quant tier for GGUF — warn when below recommended minimum (Q4_K_M). */
import fs from 'node:fs'
import path from 'node:path'

const QUANT_SCORE = {
  Q8: 80,
  Q6: 70,
  Q5: 60,
  Q4: 50,
  Q3: 35,
  Q2: 20,
  Q1: 10,
  IQ4: 48,
  IQ3: 32,
}

export const RECOMMENDED_MIN = 'Q4_K_M'

const HINT =
  `For tool-heavy agents: same model at ${RECOMMENDED_MIN}+, or a smaller coder at Q4/Q5. Then: gim start --gguf PATH`

export function parseQuantFromPath(ggufPath) {
  if (!ggufPath || typeof ggufPath !== 'string') return null
  const base = ggufPath.replace(/\\/g, '/').split('/').pop() || ''
  const m = base.match(/(?:IQ[234]|Q[1-8])(?:_[A-Z0-9]+)*/i)
  return m ? m[0].toUpperCase() : null
}

export function quantScore(quant) {
  if (!quant) return 0
  const q = quant.toUpperCase()
  for (const [prefix, score] of Object.entries(QUANT_SCORE)) {
    if (q.startsWith(prefix)) return score
  }
  return 40
}

export function assessGgufQuant(ggufPath) {
  const quant = parseQuantFromPath(ggufPath)
  const score = quantScore(quant)
  let tier = 'unknown'
  if (score >= 50) tier = 'recommended'
  else if (score >= 40) tier = 'acceptable'
  else if (score >= 30) tier = 'degraded'
  else if (quant) tier = 'severe'
  return { quant, score, tier, recommendedMin: RECOMMENDED_MIN, ggufPath: ggufPath || null }
}

export function formatQuantWarning(assessment) {
  if (!assessment) return null
  if (!assessment.quant) {
    return (
      `[YELLOW] GGUF quant not detected in filename — prefer ${RECOMMENDED_MIN}+ for tool use\n` +
      `[HINT] ${HINT}`
    )
  }
  if (assessment.tier === 'recommended') return null
  if (assessment.tier === 'acceptable') {
    return (
      `[YELLOW] Quant ${assessment.quant} — OK for chat; heavy coding/tools may degrade vs ${RECOMMENDED_MIN}\n` +
      `[HINT] ${HINT}`
    )
  }
  if (assessment.tier === 'degraded') {
    return (
      `[YELLOW] Quant ${assessment.quant} — degraded reasoning/tools; ${RECOMMENDED_MIN}+ recommended\n` +
      `[HINT] ${HINT}`
    )
  }
  return (
    `[RED] Quant ${assessment.quant} — severe degradation likely; use ${RECOMMENDED_MIN} or Q5+ for agents\n` +
    `[HINT] ${HINT}`
  )
}

/** One-line status / doctor summary: { level, detail } */
export function quantStatusRow(ggufPath, { apiMode = false } = {}) {
  if (apiMode) {
    return { level: 'green', detail: 'n/a (cloud API)' }
  }
  if (!ggufPath) {
    return { level: 'yellow', detail: 'no gguf in config — gim start --gguf PATH' }
  }
  const a = assessGgufQuant(ggufPath)
  if (!a.quant) {
    return { level: 'yellow', detail: 'quant unknown in filename — prefer Q4_K_M+' }
  }
  if (a.tier === 'recommended') {
    return { level: 'green', detail: `${a.quant} (ok for tools)` }
  }
  if (a.tier === 'acceptable') {
    return { level: 'yellow', detail: `${a.quant} — tools may degrade; ${RECOMMENDED_MIN}+ better` }
  }
  if (a.tier === 'degraded') {
    return { level: 'yellow', detail: `${a.quant} — weak for tools; ${RECOMMENDED_MIN}+ or smaller Q4 model` }
  }
  return { level: 'red', detail: `${a.quant} — too low for agents; switch to ${RECOMMENDED_MIN}+` }
}

function truthyFlag(flags, ...keys) {
  for (const k of keys) {
    if (flags?.[k] === true || flags?.[k] === '1' || flags?.[k] === 'true') return true
  }
  return false
}

/**
 * Soft policy for `gim start`:
 * - severe (Q2−): blocked unless --force-quant / GIM_FORCE_QUANT=1
 * - --require-q4 / GIM_REQUIRE_Q4=1: anything below Q4_K_M blocked (unless force)
 * - degraded (Q3): warn only by default
 *
 * @returns {{ ok: true, forced?: boolean }}
 */
export function enforceQuantPolicy(assessment, flags = {}) {
  const force =
    truthyFlag(flags, 'force-quant', 'forceQuant') || process.env.GIM_FORCE_QUANT === '1'
  const requireQ4 =
    truthyFlag(flags, 'require-q4', 'requireQ4') || process.env.GIM_REQUIRE_Q4 === '1'

  if (!assessment) return { ok: true }

  if (requireQ4) {
    const below = !assessment.quant || assessment.tier !== 'recommended'
    if (below && !force) {
      throw Object.assign(
        new Error(
          `Quant ${assessment.quant || 'unknown'} below ${RECOMMENDED_MIN} (--require-q4). ` +
            `Use ${RECOMMENDED_MIN}+ or pass --force-quant`,
        ),
        { exitCode: 2 },
      )
    }
    if (below && force) return { ok: true, forced: true }
  }

  if (assessment.tier === 'severe' && !force) {
    throw Object.assign(
      new Error(
        `Quant ${assessment.quant} too low for agents. Use ${RECOMMENDED_MIN}+ or pass --force-quant`,
      ),
      { exitCode: 2 },
    )
  }
  if (assessment.tier === 'severe' && force) return { ok: true, forced: true }
  return { ok: true }
}

/** Markdown for workspace `.gim/QUANT.md` when quant is weak. */
export function lowQuantAgentHints(assessment) {
  if (!assessment?.tier || assessment.tier === 'recommended') return null
  if (assessment.tier === 'acceptable') {
    return [
      `# Quant hint (${assessment.quant})`,
      '',
      `This GGUF is below preferred ${RECOMMENDED_MIN} for heavy coding.`,
      '- Prefer short tool loops (1–3 calls), then answer',
      '- Re-read files after edits; do not trust long recalled context',
      '- Avoid parallel speculative tool spam',
      '',
      `Upgrade: \`gim start --gguf PATH\` with ${RECOMMENDED_MIN}+`,
      '',
    ].join('\n')
  }
  if (assessment.tier === 'degraded' || assessment.tier === 'severe' || assessment.tier === 'unknown') {
    return [
      `# Quant hint (${assessment.quant || 'unknown'}) — low quality mode`,
      '',
      `Local quant is weak for tool-heavy agents (prefer ${RECOMMENDED_MIN}+).`,
      '',
      '## Tool budget',
      '- Max ~3 tool calls before a short status reply',
      '- One clear goal per turn; no exploratory ripgrep storms',
      '- Prefer `lsp_query` / targeted Read over broad Grep',
      '- After write/edit: re-Read the file once, then stop',
      '- If stuck twice: ask the user instead of looping',
      '',
      '## Upgrade',
      `\`${HINT}\``,
      '',
    ].join('\n')
  }
  return null
}

/**
 * Write or remove workspace `.gim/QUANT.md` based on assessment.
 * @returns {string|null} path written, or null if cleared/skipped
 */
export function writeQuantHintFile(deepDir, assessment) {
  if (!deepDir) return null
  fs.mkdirSync(deepDir, { recursive: true })
  const f = path.join(deepDir, 'QUANT.md')
  const body = lowQuantAgentHints(assessment)
  if (!body) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
    return null
  }
  fs.writeFileSync(f, body, 'utf8')
  return f
}
