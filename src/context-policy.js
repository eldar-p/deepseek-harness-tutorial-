/**
 * Unified context window + compaction policy for every LLM backend.
 */
import os from 'node:os'

export const DEFAULT_CONTEXT_WINDOW = Number(process.env.GIM_CTX || 512_000)

/** Cap runtime ctx on hosts below this RAM unless GIM_CTX is explicitly set. */
export const LOW_RAM_THRESHOLD_GB = Number(process.env.GIM_LOW_RAM_GB || 64)

/** Safe default ctx when RAM is below threshold (MoE OOM guard). */
export const LOW_RAM_CTX_CAP = Number(process.env.GIM_LOW_RAM_CTX || 128_000)

/** Start compacting when estimated fill exceeds this percent (Cursor-like). */
export const DEFAULT_COMPACT_PCT = Number(process.env.GIM_COMPACT_PCT || 72)

/** Recent turns to always keep verbatim after compaction. */
export const COMPACT_KEEP_MESSAGES = Number(process.env.GIM_COMPACT_KEEP || 10)

/**
 * Reduce ctx on low-RAM hosts to avoid MoE OOM. Skipped when GIM_CTX is set explicitly.
 * @param {number} requested
 * @param {{ ramGb?: number, explicitCtx?: boolean }} [opts]
 */
export function adaptiveContextCap(requested, opts = {}) {
  const ramGb = opts.ramGb ?? os.totalmem() / 1e9
  const explicit = opts.explicitCtx ?? Boolean(process.env.GIM_CTX)
  if (explicit || process.env.GIM_NO_CTX_CAP === '1') return requested
  if (ramGb < LOW_RAM_THRESHOLD_GB && requested > LOW_RAM_CTX_CAP) return LOW_RAM_CTX_CAP
  return requested
}

export function resolveContextWindow(cfg = {}, flags = {}, run = null) {
  const explicitCtx = Boolean(
    flags.ctx || flags['api-ctx'] || flags['colibri-ctx'] || process.env.GIM_CTX || run?.colibriCtx,
  )
  const n = Number(
    flags.ctx ||
      flags['api-ctx'] ||
      flags['colibri-ctx'] ||
      process.env.GIM_CTX ||
      run?.colibriCtx ||
      cfg.contextWindow ||
      cfg.api?.contextWindow ||
      run?.apiProfile?.contextWindow ||
      DEFAULT_CONTEXT_WINDOW,
  )
  const base = Number.isFinite(n) && n > 0 ? n : DEFAULT_CONTEXT_WINDOW
  return adaptiveContextCap(base, { explicitCtx })
}
