/**
 * Print a short KI / index warning after stack start (non-blocking).
 * @param {string} stack
 */
export async function maybeWarnOpportunityOnStart(stack = 'default') {
  try {
    const { assessOpportunityCost } = await import('./opportunity-cost.js')
    const r = await assessOpportunityCost(stack)
    const critical = r.factors.filter((f) => f.lost && (f.id === 'llm_warm' || f.id === 'index_built' || f.weight >= 0.12))
    if (r.K < 0.3 && !critical.length) return
    console.log(`[YELLOW] Speed opportunity K≈${r.K} — reclaimable session time`)
    for (const f of critical.slice(0, 4)) {
      console.log(`         · ${f.id}: ${f.detail}${f.fix ? ` → ${f.fix}` : ''}`)
    }
    if (r.K >= 0.3) console.log('         · full checklist: gim doctor --ki')
  } catch {
    /* never block start */
  }
}
