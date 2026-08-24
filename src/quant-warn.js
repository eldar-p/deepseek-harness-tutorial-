/** Quant tier for GGUF — warn when below recommended minimum (Q4_K_M). */

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
  return { quant, score, tier, recommendedMin: RECOMMENDED_MIN }
}

export function formatQuantWarning(assessment) {
  if (!assessment.quant) {
    return '[YELLOW] GGUF quant not detected in filename — prefer Q4_K_M or higher for tool use'
  }
  if (assessment.tier === 'recommended') return null
  if (assessment.tier === 'acceptable') {
    return `[YELLOW] Quant ${assessment.quant} — OK for chat; heavy coding/tools may degrade vs ${RECOMMENDED_MIN}`
  }
  if (assessment.tier === 'degraded') {
    return `[YELLOW] Quant ${assessment.quant} — degraded reasoning/tools; ${RECOMMENDED_MIN}+ recommended`
  }
  return `[RED] Quant ${assessment.quant} — severe degradation likely; use ${RECOMMENDED_MIN} or Q5+ for agents`
}
