/**
 * Unified context window + compaction policy for every LLM backend.
 */
export const DEFAULT_CONTEXT_WINDOW = Number(process.env.GIM_CTX || 512_000)

/** Start compacting when estimated fill exceeds this percent (Cursor-like). */
export const DEFAULT_COMPACT_PCT = Number(process.env.GIM_COMPACT_PCT || 72)

/** Recent turns to always keep verbatim after compaction. */
export const COMPACT_KEEP_MESSAGES = Number(process.env.GIM_COMPACT_KEEP || 10)

export function resolveContextWindow(cfg = {}, flags = {}, run = null) {
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
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONTEXT_WINDOW
}
