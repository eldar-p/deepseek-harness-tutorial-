/**
 * Fetch wrapper for local OpenAI /v1 backends (agent loop).
 * Node fetch pools connections per origin; explicit undici Agent when available.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** @type {import('undici').Agent | null} */
let dispatcher = null

function getDispatcher() {
  if (dispatcher) return dispatcher
  try {
    const undici = require('undici')
    if (undici?.Agent) {
      dispatcher = new undici.Agent({
        keepAliveTimeout: 120_000,
        keepAliveMaxTimeout: 600_000,
        connections: 4,
      })
    }
  } catch {
    /* native fetch pool only */
  }
  return dispatcher
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
export function llmFetch(url, init = {}) {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Connection')) headers.set('Connection', 'keep-alive')
  const d = getDispatcher()
  return fetch(url, d ? { ...init, headers, dispatcher: d } : { ...init, headers })
}

export function resetLlmFetchAgents() {
  dispatcher = null
}
