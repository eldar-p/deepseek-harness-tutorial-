/**
 * Agent loop: OpenAI tools → execute → continue; emit SSE events for the UI.
 * ask_user pauses the loop until the client posts answers (resumeMessages).
 */
import { AGENT_SYSTEM_EXTRA, ASK_PLAN_SYSTEM_EXTRA, TOOLS_TEXT_FALLBACK, modesWithTools, toolsForMode, runAgentTool, isMcpAgentTool } from './agent-tools.js'
import { runMcpAgentTool } from './mcp-client.js'
import { loadAiInstructionsBlock } from './instructions.js'
import { emitChunkedDelta, extractTextPoll, extractTextToolCall } from './clarify-detect.js'
import { llmFetch } from './llm-fetch.js'
import {
  batchTrailingToolResults,
  agentTemperature,
  textFallbackResponseFormat,
  stringifyToolResult,
} from './agent-prefill.js'
import { resolveCacheSlot } from './llm-session.js'

const MAX_ROUNDS = 8

function normalizeQuestions(args) {
  const title = args.title || 'Clarification'
  const raw = Array.isArray(args.questions) ? args.questions : []
  const questions = raw.slice(0, 8).map((q, i) => {
    const id = String(q.id || `q${i + 1}`)
    const options = Array.isArray(q.options) ? q.options.map(String).slice(0, 12) : []
    const allowFreeText =
      q.allowFreeText === true || (q.allowFreeText !== false && options.length === 0)
    return {
      id,
      prompt: String(q.prompt || id),
      options,
      allowMultiple: !!q.allowMultiple,
      allowFreeText,
      required: q.required !== false,
    }
  })
  return { title, questions }
}

/**
 * @param {{
 *   target: { baseURL: string, model: string, apiKey: string },
 *   stack: string,
 *   mode: string,
 *   system: string,
 *   messages: object[],
 *   model?: string,
 *   resumeMessages?: object[],
 *   capabilities?: { tools?: boolean, streaming?: boolean },
 *   cacheSlot?: number,
 *   chatId?: string,
 *   onEvent: (ev: object) => void,
 * }} opts
 */
export async function runAgentLoop(opts) {
  const { target, stack, mode, system, onEvent } = opts
  const useTools = modesWithTools(mode)
  const caps = opts.capabilities || { tools: true, streaming: true }
  const nativeTools = useTools && caps.tools !== false

  let messages
  if (Array.isArray(opts.resumeMessages) && opts.resumeMessages.length) {
    messages = opts.resumeMessages
  } else {
    const extra =
      mode === 'ask' || mode === 'plan' ? ASK_PLAN_SYSTEM_EXTRA : AGENT_SYSTEM_EXTRA
    const fallback = nativeTools ? '' : `\n\n${TOOLS_TEXT_FALLBACK}`
    const instructions = loadAiInstructionsBlock(stack)
    const instructionsBlock = instructions ? `\n\n${instructions}` : ''
    messages = [
      {
        role: 'system',
        content: useTools
          ? `${system}\n\n${extra}${fallback}${instructionsBlock}`
          : `${system}${instructionsBlock}`,
      },
      ...(opts.messages || []),
    ]
  }

  const cacheSlot =
    opts.cacheSlot ??
    (opts.chatId ? resolveCacheSlot(stack, opts.chatId) : 0)

  for (let round = 0; round < MAX_ROUNDS; round++) {
    messages = batchTrailingToolResults(messages)
    const temp = agentTemperature(mode, opts.temperature)
    const body = {
      model: opts.model || target.model,
      messages,
      temperature: temp,
      stream: false,
    }
    if (cacheSlot > 0) body.cache_slot = cacheSlot
    if (nativeTools) {
      body.tools = toolsForMode(mode, stack)
      body.tool_choice = 'auto'
    } else if (useTools) {
      const rf = textFallbackResponseFormat(true)
      if (rf) body.response_format = rf
    }

    let data
    try {
      const res = await llmFetch(`${target.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.apiKey || 'sk-gim-local'}`,
        },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (!res.ok) {
        onEvent({ type: 'error', error: text.slice(0, 500) || res.statusText })
        return { ok: false, messages }
      }
      data = JSON.parse(text)
    } catch (err) {
      onEvent({ type: 'error', error: err.message })
      return { ok: false, messages }
    }

    const choice = data.choices?.[0]
    const msg = choice?.message
    if (!msg) {
      onEvent({ type: 'error', error: 'empty LLM response' })
      return { ok: false, messages }
    }

    messages.push(msg)

    const toolCalls = msg.tool_calls
    if (nativeTools && Array.isArray(toolCalls) && toolCalls.length) {
      /** @type {null | { id: string, title: string, questions: object[] }} */
      let clarify = null

      for (const tc of toolCalls) {
        const name = tc.function?.name || tc.name
        let args = {}
        try {
          args = JSON.parse(tc.function?.arguments || tc.arguments || '{}')
        } catch {
          args = {}
        }

        if (name === 'ask_user') {
          const { title, questions } = normalizeQuestions(args)
          if (!questions.length) {
            onEvent({ type: 'tool_start', id: tc.id, name, args })
            const result = { ok: false, error: 'ask_user requires questions[]' }
            onEvent({ type: 'tool_result', id: tc.id, name, result })
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            })
            continue
          }
          onEvent({ type: 'tool_start', id: tc.id, name, args: { title, questions } })
          clarify = { id: tc.id, title, questions }
          // Other tool_calls in the same turn: execute first, then pause on ask_user.
          // If multiple ask_user, only first pauses; rest get skipped message.
          continue
        }

        onEvent({ type: 'tool_start', id: tc.id, name, args })
        const result = isMcpAgentTool(name)
          ? await runMcpAgentTool(name, args)
          : runAgentTool(stack, name, args)
        onEvent({ type: 'tool_result', id: tc.id, name, result })
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: stringifyToolResult(result),
        })
      }

      if (clarify) {
        // Ensure every tool_call has a tool response except the pending ask_user
        for (const tc of toolCalls) {
          const name = tc.function?.name || tc.name
          if (name !== 'ask_user') continue
          if (tc.id === clarify.id) continue
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: 'skipped — another ask_user is pending' }),
          })
        }
        onEvent({
          type: 'clarify',
          toolCallId: clarify.id,
          title: clarify.title,
          questions: clarify.questions,
          messages,
        })
        return { ok: true, paused: true, messages, clarify }
      }

      continue
    }

    const content = msg.content || ''

    // Universal text-tool protocol (same schema, no native tool_calls)
    if (useTools && !nativeTools) {
      const textTool = extractTextToolCall(content)
      if (textTool) {
        const { name, args } = textTool
        const fakeId = `text-${round}-${name}`
        onEvent({ type: 'tool_start', id: fakeId, name, args })
        if (name === 'ask_user') {
          const { title, questions } = normalizeQuestions(args)
          if (questions.length) {
            onEvent({ type: 'tool_start', id: fakeId, name, args: { title, questions } })
            onEvent({
              type: 'clarify',
              toolCallId: fakeId,
              title,
              questions,
              messages: [...messages, { role: 'assistant', content }],
            })
            return { ok: true, paused: true, messages, clarify: { id: fakeId, title, questions } }
          }
        }
        const result = isMcpAgentTool(name)
          ? await runMcpAgentTool(name, args)
          : runAgentTool(stack, name, args)
        onEvent({ type: 'tool_result', id: fakeId, name, result })
        messages.push({ role: 'assistant', content })
        messages.push({
          role: 'user',
          content: `[tool ${name} result]\n${stringifyToolResult(result)}`,
        })
        continue
      }
    }

    await emitChunkedDelta(onEvent, content)

    const poll = extractTextPoll(content)
    if (poll?.questions?.length) {
      onEvent({
        type: 'clarify',
        toolCallId: null,
        local: true,
        title: poll.title,
        questions: poll.questions,
      })
      return { ok: true, paused: true, localClarify: true, messages, content }
    }

    onEvent({ type: 'done', content })
    return { ok: true, messages, content }
  }

  onEvent({ type: 'error', error: 'tool loop limit reached' })
  return { ok: false, messages }
}

/**
 * Write agent-loop events as SSE compatible with OpenAI delta stream + custom events.
 */
export function writeSseEvent(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`)
}

/** Build resume message list after user answers ask_user. */
export function applyClarifyAnswers(pendingMessages, toolCallId, answers) {
  const messages = [...(pendingMessages || [])]
  messages.push({
    role: 'tool',
    tool_call_id: toolCallId,
    content: JSON.stringify({ ok: true, answers }),
  })
  return messages
}
