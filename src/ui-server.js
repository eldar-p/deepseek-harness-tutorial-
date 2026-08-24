/**
 * GIM native UI — static SPA + OpenAI-compatible SSE proxy.
 * Replaces DSH as the default front-end; DSH remains optional via --dsh.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { PKG_ROOT, paths, appendLog } from './paths.js'
import { readRunState } from './runstate.js'
import { readJsonFile, writeJsonFile } from './json-io.js'
import { isGuestRunning } from './guest.js'
import { listWorkspaceDir, readWorkspaceFile, modesWithTools } from './agent-tools.js'
import { runAgentLoop, writeSseEvent, applyClarifyAnswers } from './agent-loop.js'
import { estimateContextUsage } from './context-estimate.js'
import { resolveContextWindow } from './context-policy.js'
import { compactMessagesIfNeeded } from './context-compact.js'
import { probeLlmCapabilities } from './llm-capabilities.js'
import { DEFAULT_KV_SLOTS, releaseCacheSlot } from './llm-session.js'

/** Per-stack capability cache — probe once, not on every chat turn. */
const stackCapabilities = new Map()

async function getStackCapabilities(stack, target) {
  if (stackCapabilities.has(stack)) return stackCapabilities.get(stack)
  const caps = await probeLlmCapabilities(target).catch(() => ({
    tools: true,
    streaming: true,
    openaiCompletions: true,
  }))
  stackCapabilities.set(stack, caps)
  return caps
}

const UI_ROOT = path.join(PKG_ROOT, 'ui')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const MODE_SYSTEM = {
  agent:
    'You are GIM Agent mode. Explore the workspace with tools, make concrete edits via write_file, run checks with guest_bash. Prefer short actionable steps.',
  ask: 'You are GIM Ask mode. Answer questions clearly. Do not invent file edits or run destructive actions; explain only. If the question is ambiguous, use ask_user.',
  plan: 'You are GIM Plan mode. Produce a structured plan (goals, steps, risks, verification). Do not implement yet unless asked. If requirements are unclear, use ask_user first.',
  debug:
    'You are GIM Debug mode. Use tools to gather evidence, hypothesize causes, propose minimal repros and fixes. Be precise about files and symptoms.',
}

function chatsDir(stack) {
  const dir = path.join(paths(stack).workspace, '.gim', 'chats')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function attachmentsDir(stack) {
  const dir = path.join(paths(stack).workspace, '.gim', 'attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function listChats(stack) {
  const dir = chatsDir(stack)
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const c = readJsonFile(path.join(dir, f))
        return {
          id: c.id,
          title: c.title || 'Untitled',
          mode: c.mode || 'agent',
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

function loadChat(stack, id) {
  const f = path.join(chatsDir(stack), `${id}.json`)
  if (!fs.existsSync(f)) return null
  return readJsonFile(f)
}

function saveChat(stack, chat) {
  chat.updatedAt = new Date().toISOString()
  writeJsonFile(path.join(chatsDir(stack), `${chat.id}.json`), chat)
  return chat
}

function resolveLlmTarget(stack) {
  const run = readRunState(stack) || {}
  if (run.apiProfile?.baseURL) {
    const keyEnv = run.apiProfile.apiKeyEnv || ''
    return {
      kind: run.llm === 'colibri' || run.device === 'colibri' || run.apiProfile.id === 'colibri' ? 'colibri' : 'api',
      baseURL: String(run.apiProfile.baseURL).replace(/\/$/, ''),
      model: run.apiProfile.model || 'default',
      apiKey:
        (keyEnv && process.env[keyEnv]) ||
        process.env.GIM_COLIBRI_API_KEY ||
        process.env.GIM_API_KEY ||
        'sk-gim-colibri',
    }
  }
  const llamaPort = run.ports?.llamaPort
  if (llamaPort) {
    return {
      kind: 'llama',
      baseURL: `http://127.0.0.1:${llamaPort}/v1`,
      model: run.apiProfile?.model || run.model || 'coder',
      apiKey: process.env.GIM_LLAMA_API_KEY || 'sk-gim-local',
    }
  }
  if (run.urls?.colibri || run.urls?.llama) {
    const u = String(run.urls.colibri || run.urls.llama).replace(/\/$/, '')
    const base = u.endsWith('/v1') ? u : `${u}/v1`
    return {
      kind: run.urls.colibri ? 'colibri' : 'url',
      baseURL: base,
      model: run.apiProfile?.model || run.colibriModelId || 'coder',
      apiKey: process.env.GIM_COLIBRI_API_KEY || process.env.GIM_LLAMA_API_KEY || 'sk-gim-colibri',
    }
  }
  return null
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404).end('Not found')
    return
  }
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

function safeInside(root, rel) {
  const full = path.resolve(root, rel)
  if (!full.startsWith(path.resolve(root))) return null
  return full
}

async function proxyChatCompletions(req, res, stack, payload) {
  const target = resolveLlmTarget(stack)
  if (!target) {
    sendJson(res, 503, { error: 'No LLM backend — run gim start first' })
    return
  }

  const mode = payload.mode || 'agent'
  const system = MODE_SYSTEM[mode] || MODE_SYSTEM.agent
  const run = readRunState(stack) || {}
  const contextWindow = resolveContextWindow({}, {}, run)
  let userMessages = payload.messages || []
  const capabilities =
    payload.capabilities || (target ? await getStackCapabilities(stack, target) : null)

  const compact = await compactMessagesIfNeeded({
    messages: userMessages,
    contextWindow,
    mode,
    stack,
    system,
    target,
    model: payload.model,
  })
  if (compact.compacted) {
    userMessages = compact.messages
    appendLog(
      `event=context_compact stack=${stack} dropped=${compact.dropped} pct=${compact.usage?.pct}`,
    )
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  if (modesWithTools(mode)) {
    if (compact.compacted) {
      writeSseEvent(res, {
        gim: true,
        type: 'context_compact',
        dropped: compact.dropped,
        usage: compact.usage,
        preview: compact.summaryPreview,
      })
    }
    const result = await runAgentLoop({
      target,
      stack,
      mode,
      system,
      messages: userMessages,
      resumeMessages: payload.resumeMessages || null,
      model: payload.model,
      temperature: payload.temperature,
      chatId: payload.chatId || null,
      capabilities,
      onEvent: (ev) => {
        if (ev.type === 'assistant_delta') {
          writeSseEvent(res, { choices: [{ delta: { content: ev.content } }] })
        } else if (ev.type === 'done') {
          writeSseEvent(res, { gim: true, ...ev })
          res.write('data: [DONE]\n\n')
        } else if (ev.type === 'clarify') {
          if (payload.chatId && ev.toolCallId && !ev.local) {
            const chat = loadChat(stack, payload.chatId)
            if (chat) {
              chat.pendingClarify = {
                toolCallId: ev.toolCallId,
                title: ev.title,
                questions: ev.questions,
                messages: ev.messages,
              }
              saveChat(stack, chat)
            }
          }
          writeSseEvent(res, {
            gim: true,
            type: 'clarify',
            toolCallId: ev.toolCallId || null,
            local: !!ev.local,
            title: ev.title,
            questions: ev.questions,
          })
          res.write('data: [DONE]\n\n')
        } else if (ev.type === 'error') {
          writeSseEvent(res, { gim: true, ...ev })
          writeSseEvent(res, {
            choices: [{ delta: { content: `\n\n[error] ${ev.error}` } }],
          })
          res.write('data: [DONE]\n\n')
        } else {
          writeSseEvent(res, { gim: true, ...ev })
        }
      },
    })
    if (result.paused && payload.chatId && result.clarify && !result.localClarify) {
      const chat = loadChat(stack, payload.chatId)
      if (chat && result.clarify) {
        chat.pendingClarify = {
          toolCallId: result.clarify.id,
          title: result.clarify.title,
          questions: result.clarify.questions,
          messages: result.messages,
        }
        saveChat(stack, chat)
      }
    } else if (!result.paused && payload.chatId) {
      const chat = loadChat(stack, payload.chatId)
      if (chat?.pendingClarify) {
        delete chat.pendingClarify
        saveChat(stack, chat)
      }
    }
    res.end()
    return
  }

  const body = JSON.stringify({
    model: payload.model || target.model,
    messages: [{ role: 'system', content: system }, ...userMessages],
    stream: true,
    temperature: payload.temperature ?? 0.3,
  })

  let upstream
  try {
    upstream = await fetch(`${target.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey || 'sk-gim-local'}`,
      },
      body,
    })
  } catch (err) {
    writeSseEvent(res, { gim: true, type: 'error', error: `LLM unreachable: ${err.message}` })
    res.end()
    return
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    writeSseEvent(res, { gim: true, type: 'error', error: text.slice(0, 500) || upstream.statusText })
    res.end()
    return
  }

  const reader = upstream.body?.getReader?.()
  if (!reader) {
    const text = await upstream.text()
    res.write(text)
    res.end()
    return
  }

  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
  } catch {
    /* client abort */
  }
  res.end()
}

/**
 * @param {{ stack?: string, port?: number, host?: string }} opts
 * @returns {Promise<{ server: import('node:http').Server, port: number, url: string }>}
 */
export function startUiServer(opts = {}) {
  const stack = opts.stack || 'default'
  const host = opts.host || '127.0.0.1'
  const port = opts.port || Number(process.env.GIM_UI_PORT || 7420)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`)
    const p = url.pathname

    try {
      if (p === '/api/health') {
        return sendJson(res, 200, { ok: true, product: 'GIM CLI', stack })
      }

      if (p === '/api/session' && req.method === 'GET') {
        const run = readRunState(stack) || {}
        const target = resolveLlmTarget(stack)
        const guestUp = isGuestRunning(stack)
        const capabilities = target ? await getStackCapabilities(stack, target) : null
        return sendJson(res, 200, {
          stack,
          workspace: paths(stack).workspace,
          guest: run.guestName || (guestUp ? `gim-guest-${stack}` : null),
          guestRunning: guestUp,
          device: run.device || null,
          llm: target
            ? { kind: target.kind, baseURL: target.baseURL, model: target.model }
            : null,
          urls: run.urls || {},
          models: [target?.model, run.apiProfile?.model, 'default'].filter(
            (v, i, a) => v && a.indexOf(v) === i,
          ),
          llmModel: run.colibriModel ? { path: run.colibriModel, id: run.apiProfile?.model } : null,
          kvSlots: DEFAULT_KV_SLOTS,
          modes: ['agent', 'ask', 'plan', 'debug'],
          tools: ['list_dir', 'read_file', 'write_file', 'search_files', 'guest_bash', 'ask_user'],
          contextWindow: resolveContextWindow({}, {}, run),
          capabilities,
        })
      }

      if (p === '/api/files' && req.method === 'GET') {
        const rel = url.searchParams.get('path') || '.'
        return sendJson(res, 200, listWorkspaceDir(stack, rel))
      }

      if (p === '/api/files/read' && req.method === 'GET') {
        const rel = url.searchParams.get('path')
        if (!rel) return sendJson(res, 400, { error: 'path required' })
        return sendJson(res, 200, readWorkspaceFile(stack, rel))
      }

      if (p === '/api/context' && req.method === 'POST') {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        return sendJson(
          res,
          200,
          estimateContextUsage({
            mode: body.mode || 'agent',
            stack,
            messages: body.messages || [],
            contextWindow: body.contextWindow,
            system: body.system,
          }),
        )
      }

      if (p === '/api/chats' && req.method === 'GET') {
        return sendJson(res, 200, { chats: listChats(stack) })
      }

      if (p === '/api/chats' && req.method === 'POST') {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const chat = {
          id: randomUUID(),
          title: body.title || 'New chat',
          mode: body.mode || 'agent',
          model: body.model || null,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        saveChat(stack, chat)
        return sendJson(res, 201, chat)
      }

      const chatMatch = p.match(/^\/api\/chats\/([^/]+)$/)
      if (chatMatch && req.method === 'GET') {
        const chat = loadChat(stack, chatMatch[1])
        if (!chat) return sendJson(res, 404, { error: 'chat not found' })
        return sendJson(res, 200, chat)
      }

      if (chatMatch && req.method === 'PUT') {
        const raw = await readBody(req)
        const body = JSON.parse(raw.toString('utf8'))
        const prev = loadChat(stack, chatMatch[1]) || { id: chatMatch[1], createdAt: new Date().toISOString() }
        const chat = saveChat(stack, {
          ...prev,
          ...body,
          id: chatMatch[1],
          // Client UI saves often without pendingClarify.messages — keep server pending
          pendingClarify:
            body.pendingClarify === null
              ? undefined
              : body.pendingClarify || prev.pendingClarify,
        })
        if (!chat.pendingClarify) delete chat.pendingClarify
        return sendJson(res, 200, chat)
      }

      if (chatMatch && req.method === 'DELETE') {
        const chatId = chatMatch[1]
        releaseCacheSlot(stack, chatId)
        const f = path.join(chatsDir(stack), `${chatId}.json`)
        if (fs.existsSync(f)) fs.unlinkSync(f)
        return sendJson(res, 200, { ok: true })
      }

      if (p === '/api/chat/completions' && req.method === 'POST') {
        const raw = await readBody(req)
        const payload = JSON.parse(raw.toString('utf8'))
        return await proxyChatCompletions(req, res, stack, payload)
      }

      if (p === '/api/chat/clarify' && req.method === 'POST') {
        const raw = await readBody(req)
        const body = JSON.parse(raw.toString('utf8'))
        const chatId = body.chatId
        const chat = chatId ? loadChat(stack, chatId) : null

        // Local text-poll: no tool_call pending — just continue with answers as user text
        if (!chat?.pendingClarify) {
          const lines = ['[Clarification answers]']
          for (const [k, v] of Object.entries(body.answers || {})) {
            const val = Array.isArray(v) ? v.join(', ') : v
            lines.push(`- ${k}: ${val ?? ''}`)
          }
          return await proxyChatCompletions(req, res, stack, {
            mode: body.mode || chat?.mode || 'agent',
            model: body.model || chat?.model,
            chatId,
            messages: [
              ...((chat?.messages || [])
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({
                  role: m.role,
                  content:
                    m.content ||
                    (m.tools?.length ? m.tools.map((t) => `[used tool ${t.name}]`).join(' ') : ''),
                }))
                .filter((m) => m.content)),
              { role: 'user', content: lines.join('\n') },
            ],
          })
        }

        const pending = chat.pendingClarify
        const resumeMessages = applyClarifyAnswers(
          pending.messages,
          pending.toolCallId,
          body.answers || {},
        )
        delete chat.pendingClarify
        saveChat(stack, chat)

        return await proxyChatCompletions(req, res, stack, {
          mode: body.mode || chat.mode || 'agent',
          model: body.model || chat.model,
          chatId,
          resumeMessages,
          messages: [],
        })
      }

      if (p === '/api/attachments' && req.method === 'POST') {
        const raw = await readBody(req)
        const body = JSON.parse(raw.toString('utf8'))
        const name = String(body.name || 'paste.txt').replace(/[^\w.\-]+/g, '_')
        const id = randomUUID().slice(0, 8)
        const file = path.join(attachmentsDir(stack), `${id}-${name}`)
        const content = String(body.content || '')
        if (content.length > 2_000_000) return sendJson(res, 413, { error: 'attachment too large' })
        fs.writeFileSync(file, content, 'utf8')
        const rel = path.relative(paths(stack).workspace, file).replace(/\\/g, '/')
        return sendJson(res, 201, {
          id,
          name,
          path: rel,
          bytes: Buffer.byteLength(content, 'utf8'),
          preview: content.slice(0, 400),
        })
      }

      if (p === '/brand/gim-mark.png') {
        return serveFile(res, path.join(PKG_ROOT, 'assets', 'gim-mark.png'))
      }

      // static UI
      let rel = p === '/' ? 'index.html' : p.replace(/^\//, '')
      if (rel.includes('..')) return res.writeHead(400).end('bad path')
      const file = safeInside(UI_ROOT, rel)
      if (!file) return res.writeHead(400).end('bad path')
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file)
      // SPA fallback
      return serveFile(res, path.join(UI_ROOT, 'index.html'))
    } catch (err) {
      appendLog(`event=ui_error stack=${stack} err=${err?.message || err}`)
      if (!res.headersSent) sendJson(res, 500, { error: String(err?.message || err) })
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const addr = server.address()
      const actual = typeof addr === 'object' && addr ? addr.port : port
      resolve({
        server,
        port: actual,
        url: `http://${host}:${actual}/`,
      })
    })
  })
}

/** Detached helper entry used by scripts/gim-ui.mjs */
export async function mainUi(argv = process.argv.slice(2)) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[a.slice(2)] = argv[++i]
      else flags[a.slice(2)] = true
    }
  }
  const stack = flags.name || flags.stack || 'default'
  const port = flags.port ? Number(flags.port) : undefined
  const { url, port: p } = await startUiServer({ stack, port })
  console.log(`[GREEN] GIM UI ${url} (stack=${stack})`)
  appendLog(`event=ui_start stack=${stack} port=${p}`)
}
