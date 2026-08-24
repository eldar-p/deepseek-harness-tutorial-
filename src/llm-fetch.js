/**
 * Fetch wrapper for local OpenAI /v1 backends (agent loop).
 * Uses Node built-in fetch — no extra deps; connection reuse is handled by the runtime.
 */

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
export function llmFetch(url, init = {}) {
  return fetch(url, init)
}

export function resetLlmFetchAgents() {
  /* no-op — reserved for tests / future dispatcher pool */
}
