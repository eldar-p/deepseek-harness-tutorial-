/**
 * Universal LLM capability probe — one contract for every backend.
 * GIM never forks tool schemas per model; we probe what the endpoint supports
 * and adapt the harness (streaming, tool_calls) at runtime.
 */

const cache = new Map()

/**
 * @param {{ baseURL: string, model: string, apiKey?: string }} target
 * @param {{ timeoutMs?: number, force?: boolean }} [opts]
 */
export async function probeLlmCapabilities(target, { timeoutMs = 12_000, force = false } = {}) {
  const key = `${target.baseURL}|${target.model}|${target.apiKey || ''}`
  if (!force && cache.has(key)) return cache.get(key)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${target.apiKey || 'sk-gim-local'}`,
  }

  /** @type {{
   *   openaiCompletions: boolean,
   *   tools: boolean,
   *   streaming: boolean,
   *   models: string[],
   *   contextWindow: number|null,
   *   defaultModel: string,
   *   detail: string[],
   * }} */
  const caps = {
    openaiCompletions: false,
    tools: false,
    streaming: false,
    models: [],
    contextWindow: null,
    defaultModel: target.model || 'default',
    detail: [],
  }

  const base = String(target.baseURL || '').replace(/\/$/, '')

  // 1) /models — any OpenAI-compatible server
  try {
    const res = await fetch(`${base}/models`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.ok) {
      caps.openaiCompletions = true
      const data = await res.json()
      caps.models = (data.data || []).map((m) => m.id).filter(Boolean)
      caps.detail.push('models:ok')
    } else if (res.status === 401) {
      // Colibri etc. — still OpenAI-shaped, needs auth on /models
      caps.openaiCompletions = true
      caps.detail.push(`models:auth(${res.status})`)
    } else {
      caps.detail.push(`models:${res.status}`)
    }
  } catch (e) {
    caps.detail.push(`models:err(${e.message})`)
  }

  // 2) Minimal completion — confirms chat/completions works
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
        temperature: 0,
        stream: false,
      }),
    })
    if (res.ok) {
      caps.openaiCompletions = true
      caps.detail.push('chat:ok')
    } else {
      caps.detail.push(`chat:${res.status}`)
    }
  } catch (e) {
    caps.detail.push(`chat:err(${e.message})`)
  }

  // 3) Tool-calling probe — same schema for ALL models
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: 'user', content: 'List current directory using list_dir.' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_dir',
              description: 'List directory',
              parameters: { type: 'object', properties: { path: { type: 'string' } } },
            },
          },
        ],
        tool_choice: 'auto',
        max_tokens: 64,
        temperature: 0,
        stream: false,
      }),
    })
    if (res.ok) {
      caps.tools = true
      caps.detail.push('tools:ok')
    } else {
      caps.detail.push(`tools:${res.status}`)
    }
  } catch (e) {
    caps.detail.push(`tools:err(${e.message})`)
  }

  // 4) Streaming probe
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 4,
        stream: true,
      }),
    })
    if (res.ok && (res.headers.get('content-type') || '').includes('text/event-stream')) {
      caps.streaming = true
      caps.detail.push('stream:ok')
      try {
        await res.body?.cancel?.()
      } catch {
        /* */
      }
    } else {
      caps.detail.push(`stream:${res.status}`)
    }
  } catch (e) {
    caps.detail.push(`stream:err(${e.message})`)
  }

  cache.set(key, caps)
  return caps
}

export function clearCapabilityCache() {
  cache.clear()
}
