/** GIM UI — chats, modes, streaming, clarify polls, context meter */

const state = {
  session: null,
  chats: [],
  chatId: null,
  chat: null,
  mode: 'agent',
  model: 'coder',
  attachments: [],
  streaming: false,
  filesPath: '.',
  clarify: null,
  context: null,
}

const $ = (id) => document.getElementById(id)

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

import { splitThoughts } from './thoughts.js'

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = j.error || msg
    } catch {
      /* */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

function formatTokens(n) {
  const v = Number(n) || 0
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`
  return String(v)
}

function renderChatList() {
  const el = $('chat-list')
  el.innerHTML = ''
  for (const c of state.chats) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chat-item' + (c.id === state.chatId ? ' active' : '')
    b.innerHTML = `<span class="t">${esc(c.title)}</span><span class="s">${esc(c.mode || '')}</span>`
    b.onclick = () => openChat(c.id)
    el.appendChild(b)
  }
}

function renderThread() {
  const thread = $('thread')
  thread.innerHTML = ''
  const msgs = state.chat?.messages || []
  if (!msgs.length) {
    thread.innerHTML = `
      <div class="empty">
        <img src="/brand/gim-mark.png" alt="" />
        <div><strong>GIM</strong> — Agent · Ask · Plan · Debug</div>
        <p>Chats live in the stack workspace. Modes and attach live in the composer. Tap the ring for context usage.</p>
      </div>`
    return
  }
  for (const m of msgs) {
    thread.appendChild(renderMessage(m))
  }
  thread.scrollTop = thread.scrollHeight
}

function renderMessage(m) {
  const wrap = document.createElement('div')
  wrap.className = `msg ${m.role}`
  const role = document.createElement('div')
  role.className = 'role'
  role.textContent = m.role
  wrap.appendChild(role)

  if (m.role === 'assistant') {
    if (Array.isArray(m.tools) && m.tools.length) {
      for (const t of m.tools) {
        const card = document.createElement('div')
        card.className = 'tool-card'
        const summary = t.result
          ? JSON.stringify(t.result, null, 0).slice(0, 600)
          : t.args
            ? JSON.stringify(t.args)
            : '…'
        card.innerHTML = `<div class="tn">${esc(t.name || 'tool')}</div><pre></pre>`
        card.querySelector('pre').textContent = summary
        wrap.appendChild(card)
      }
    }
    const { thoughts, visible } = splitThoughts(m.content || '')
    if (thoughts) {
      const det = document.createElement('details')
      det.className = 'thoughts'
      if (m._streamingThoughts) det.open = true
      det.innerHTML = `<summary>Thoughts</summary><pre></pre>`
      det.querySelector('pre').textContent = thoughts
      wrap.appendChild(det)
    }
    const bubble = document.createElement('div')
    bubble.className = 'bubble'
    bubble.textContent = visible || (m._streaming && !(m.tools || []).length ? '…' : '')
    if (bubble.textContent) wrap.appendChild(bubble)
  } else {
    const bubble = document.createElement('div')
    bubble.className = 'bubble'
    bubble.textContent = m.content || ''
    wrap.appendChild(bubble)
  }
  return wrap
}

function joinPath(base, name) {
  if (!base || base === '.') return name
  return `${base.replace(/\/$/, '')}/${name}`
}

function parentPath(p) {
  if (!p || p === '.') return '.'
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return parts.length ? parts.join('/') : '.'
}

async function loadFiles(rel = state.filesPath) {
  state.filesPath = rel || '.'
  $('files-path').textContent = state.filesPath
  const data = await api(`/api/files?path=${encodeURIComponent(state.filesPath)}`)
  const list = $('files-list')
  list.innerHTML = ''
  if (!data.ok) {
    list.innerHTML = `<div class="meta">${esc(data.error || 'error')}</div>`
    return
  }
  if (state.filesPath !== '.') {
    const up = document.createElement('button')
    up.type = 'button'
    up.className = 'file-item'
    up.innerHTML = `<span class="ico">..</span><span>..</span>`
    up.onclick = () => loadFiles(parentPath(state.filesPath))
    list.appendChild(up)
  }
  const entries = [...(data.entries || [])].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'dir' ? -1 : 1
  })
  for (const e of entries) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'file-item'
    b.innerHTML = `<span class="ico">${e.type === 'dir' ? '/' : '·'}</span><span>${esc(e.name)}</span>`
    b.onclick = async () => {
      const next = joinPath(state.filesPath, e.name)
      if (e.type === 'dir') return loadFiles(next)
      const file = await api(`/api/files/read?path=${encodeURIComponent(next)}`)
      const prev = $('files-preview')
      if (file.ok) {
        prev.hidden = false
        prev.textContent = (file.content || '').slice(0, 4000)
      } else {
        prev.hidden = false
        prev.textContent = file.error || 'read failed'
      }
    }
    list.appendChild(b)
  }
}

function renderAttachBar() {
  const bar = $('attach-bar')
  bar.innerHTML = ''
  for (const a of state.attachments) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.innerHTML = `${esc(a.name)} <button type="button" aria-label="Remove">×</button>`
    chip.querySelector('button').onclick = () => {
      state.attachments = state.attachments.filter((x) => x !== a)
      renderAttachBar()
    }
    bar.appendChild(chip)
  }
}

function setMode(mode) {
  state.mode = mode
  document.querySelectorAll('.mode').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode)
  })
  if (state.chat) {
    state.chat.mode = mode
    persistChat()
  }
  refreshContext().catch(() => {})
}

async function persistChat() {
  if (!state.chat) return
  await api(`/api/chats/${state.chat.id}`, {
    method: 'PUT',
    body: JSON.stringify(state.chat),
  })
  await refreshChats()
  refreshContext().catch(() => {})
}

async function refreshChats() {
  const data = await api('/api/chats')
  state.chats = data.chats || []
  renderChatList()
}

async function openChat(id) {
  const chat = await api(`/api/chats/${id}`)
  state.chatId = id
  state.chat = chat
  setMode(chat.mode || 'agent')
  if (chat.model) {
    state.model = chat.model
    $('model-select').value = chat.model
  }
  renderChatList()
  renderThread()
  if (chat.pendingClarify?.questions?.length) {
    showClarify({
      title: chat.pendingClarify.title,
      questions: chat.pendingClarify.questions,
      toolCallId: chat.pendingClarify.toolCallId,
      local: false,
    })
  } else {
    hideClarify()
  }
  refreshContext().catch(() => {})
}

async function newChat() {
  const chat = await api('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ title: 'New chat', mode: state.mode, model: state.model }),
  })
  await refreshChats()
  await openChat(chat.id)
}

function buildUserContent(text) {
  if (!state.attachments.length) return text
  const blocks = state.attachments.map(
    (a) => `\n\n---\nAttached: ${a.name} (${a.path})\n\`\`\`\n${a.preview || a.content || ''}\n\`\`\`\n`,
  )
  return text + blocks.join('')
}

/** History for the LLM — keep tool summaries so the agent doesn't loop menus. */
function messagesForLlm(excludeLastUser = false) {
  const msgs = state.chat?.messages || []
  const list = excludeLastUser ? msgs.slice(0, -1) : msgs
  return list
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (m.role === 'user') return { role: 'user', content: m.content || '' }
      let content = m.content || ''
      if (Array.isArray(m.tools) && m.tools.length) {
        const toolsNote = m.tools
          .map((t) => {
            const r = t.result ? JSON.stringify(t.result).slice(0, 800) : ''
            return `[tool ${t.name}] ${r}`
          })
          .join('\n')
        content = content ? `${content}\n\n${toolsNote}` : toolsNote
      }
      return { role: 'assistant', content }
    })
    .filter((m) => m.content)
}

function hideClarify() {
  state.clarify = null
  $('clarify').hidden = true
  $('clarify-form').innerHTML = ''
}

function showClarify({ title, questions, toolCallId, local }) {
  state.clarify = { title, questions, toolCallId, local: !!local }
  $('clarify').hidden = false
  $('clarify-title').textContent = title || 'Clarification'
  const form = $('clarify-form')
  form.innerHTML = ''
  for (const q of questions || []) {
    const box = document.createElement('div')
    box.className = 'clarify-q'
    box.dataset.id = q.id
    const prompt = document.createElement('div')
    prompt.className = 'qp'
    prompt.textContent = q.prompt + (q.required === false ? ' (optional)' : '')
    box.appendChild(prompt)
    if (q.options?.length) {
      const opts = document.createElement('div')
      opts.className = 'opts'
      for (const opt of q.options) {
        const lab = document.createElement('label')
        lab.className = 'opt'
        const input = document.createElement('input')
        input.type = q.allowMultiple ? 'checkbox' : 'radio'
        input.name = `q_${q.id}`
        input.value = opt
        lab.appendChild(input)
        lab.appendChild(document.createTextNode(opt))
        opts.appendChild(lab)
      }
      box.appendChild(opts)
    }
    if (q.allowFreeText || !q.options?.length) {
      const ta = document.createElement('textarea')
      ta.rows = 2
      ta.placeholder = q.options?.length ? 'Or type your own…' : 'Your answer…'
      ta.dataset.freetext = '1'
      box.appendChild(ta)
    }
    form.appendChild(box)
  }
  threadScroll()
}

function threadScroll() {
  const thread = $('thread')
  if (thread) thread.scrollTop = thread.scrollHeight
}

function collectClarifyAnswers() {
  const answers = {}
  for (const box of $('clarify-form').querySelectorAll('.clarify-q')) {
    const id = box.dataset.id
    const q = state.clarify?.questions?.find((x) => x.id === id)
    const checked = [...box.querySelectorAll('input:checked')].map((i) => i.value)
    const free = box.querySelector('[data-freetext]')?.value?.trim() || ''
    if (q?.allowMultiple) {
      const merged = [...checked]
      if (free) merged.push(free)
      answers[id] = merged
    } else if (checked.length) {
      answers[id] = free ? `${checked[0]} — ${free}` : checked[0]
    } else {
      answers[id] = free
    }
    if (q?.required !== false && (answers[id] === '' || (Array.isArray(answers[id]) && !answers[id].length))) {
      throw new Error(`Answer required: ${q.prompt}`)
    }
  }
  return answers
}

function applyContextMeter(data) {
  state.context = data
  const pct = data?.pct ?? 0
  const circ = 2 * Math.PI * 14
  const fill = $('ctx-fill')
  const offset = circ * (1 - Math.min(100, pct) / 100)
  fill.style.strokeDasharray = String(circ)
  fill.style.strokeDashoffset = String(offset)
  fill.classList.toggle('warn', pct >= 70 && pct < 90)
  fill.classList.toggle('hot', pct >= 90)
  $('ctx-pct').textContent = `${pct}%`
  $('ctx-full-label').textContent = `${pct}% Full`
  $('ctx-tokens').textContent = `~${formatTokens(data.used)} / ${formatTokens(data.contextWindow)} Tokens`

  const bar = $('ctx-bar')
  bar.innerHTML = ''
  const used = Math.max(1, data.used || 1)
  for (const b of data.buckets || []) {
    if (!b.tokens) continue
    const seg = document.createElement('div')
    seg.className = 'ctx-seg'
    seg.style.width = `${Math.max(1, (b.tokens / used) * 100)}%`
    seg.style.background = b.color
    seg.title = `${b.label}: ${formatTokens(b.tokens)}`
    bar.appendChild(seg)
  }

  const legend = $('ctx-legend')
  legend.innerHTML = ''
  for (const b of data.buckets || []) {
    const li = document.createElement('li')
    li.innerHTML = `<span class="ctx-swatch" style="background:${esc(b.color)}"></span><span class="lab">${esc(b.label)}</span><span class="tok">${esc(formatTokens(b.tokens))}</span>`
    legend.appendChild(li)
  }
}

async function refreshContext() {
  const messages = (state.chat?.messages || []).map((m) => ({
    role: m.role,
    content: m.content || '',
    tools: m.tools,
    meta: m.meta,
  }))
  const data = await api('/api/context', {
    method: 'POST',
    body: JSON.stringify({
      mode: state.mode,
      messages,
      contextWindow: state.session?.contextWindow || undefined,
    }),
  })
  applyContextMeter(data)
}

function toggleContextPanel(force) {
  const panel = $('ctx-panel')
  const open = force ?? panel.hidden
  panel.hidden = !open
  $('btn-context').setAttribute('aria-expanded', open ? 'true' : 'false')
  if (open) refreshContext().catch(() => {})
}

async function consumeSse(res, assistant) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let clarified = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n')
    buf = parts.pop() || ''
    for (const line of parts) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const j = JSON.parse(data)
        if (j.gim) {
          if (j.type === 'tool_start') {
            assistant.tools.push({ id: j.id, name: j.name, args: j.args })
            renderThread()
          } else if (j.type === 'tool_result') {
            const slot =
              assistant.tools.find((x) => x.id === j.id) || assistant.tools[assistant.tools.length - 1]
            if (slot) slot.result = j.result
            renderThread()
            if (j.name === 'write_file' || j.name === 'guest_bash') loadFiles(state.filesPath).catch(() => {})
          } else if (j.type === 'clarify') {
            clarified = true
            showClarify({
              title: j.title,
              questions: j.questions,
              toolCallId: j.toolCallId,
              local: j.local,
            })
            if (!assistant.content) {
              assistant.content = `(waiting for your answers: ${j.title || 'clarification'})`
            }
            renderThread()
          } else if (j.type === 'error') {
            assistant.content += `\n\n[error] ${j.error}`
            renderThread()
          }
          continue
        }
        const delta =
          j.choices?.[0]?.delta?.content ||
          j.choices?.[0]?.delta?.reasoning_content ||
          j.choices?.[0]?.text ||
          ''
        if (j.choices?.[0]?.delta?.reasoning_content) {
          assistant.content += `<think>${j.choices[0].delta.reasoning_content}</think>`
        } else if (delta) {
          assistant.content += delta
        }
        renderThread()
      } catch {
        /* partial json */
      }
    }
  }
  return { clarified }
}

async function runAssistantTurn({ url, body }) {
  const assistant = { role: 'assistant', content: '', tools: [], _streaming: true, _streamingThoughts: true }
  state.chat.messages.push(assistant)
  renderThread()

  state.streaming = true
  $('btn-send').disabled = true
  $('btn-clarify-submit').disabled = true

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || res.statusText)
    }

    await consumeSse(res, assistant)
  } catch (err) {
    assistant.content += `\n\n[error] ${err.message}`
    renderThread()
  } finally {
    delete assistant._streaming
    delete assistant._streamingThoughts
    state.streaming = false
    $('btn-send').disabled = false
    $('btn-clarify-submit').disabled = false
    await persistChat()
    renderThread()
    refreshContext().catch(() => {})
  }
}

async function send() {
  if (state.streaming) return
  const input = $('input')
  const text = input.value.trim()
  if (!text && !state.attachments.length) return
  // New user message overrides an unanswered local poll
  if (state.clarify) hideClarify()
  if (!state.chat) await newChat()

  const content = buildUserContent(text)
  input.value = ''
  state.attachments = []
  renderAttachBar()

  state.chat.messages.push({ role: 'user', content })
  if (state.chat.title === 'New chat' && text) {
    state.chat.title = text.slice(0, 48)
  }
  await persistChat()
  renderThread()

  await runAssistantTurn({
    url: '/api/chat/completions',
    body: {
      mode: state.mode,
      model: state.model,
      chatId: state.chat.id,
      messages: messagesForLlm(true),
    },
  })
}

async function submitClarify() {
  if (!state.clarify || !state.chat || state.streaming) return
  let answers
  try {
    answers = collectClarifyAnswers()
  } catch (err) {
    alert(err.message)
    return
  }

  const lines = ['[Clarification answers]']
  for (const q of state.clarify.questions || []) {
    const a = answers[q.id]
    const val = Array.isArray(a) ? a.join(', ') : a
    lines.push(`- ${q.prompt}: ${val ?? '(skipped)'}`)
  }

  hideClarify()
  state.chat.messages.push({ role: 'user', content: lines.join('\n'), meta: { kind: 'clarify_reply' } })
  await persistChat()
  renderThread()

  await runAssistantTurn({
    url: '/api/chat/clarify',
    body: {
      chatId: state.chat.id,
      mode: state.mode,
      model: state.model,
      answers,
    },
  })
}

async function attachFiles(fileList) {
  for (const file of fileList) {
    const content = await file.text()
    const saved = await api('/api/attachments', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, content }),
    })
    state.attachments.push({
      name: saved.name,
      path: saved.path,
      preview: saved.preview,
      content: content.slice(0, 8000),
    })
  }
  renderAttachBar()
  refreshContext().catch(() => {})
}

async function boot() {
  state.session = await api('/api/session')
  const llm = state.session.llm
  const models = (state.session.models?.length ? state.session.models : [llm?.model || 'coder', 'coder']).filter(
    (v, i, a) => v && a.indexOf(v) === i,
  )
  const sel = $('model-select')
  sel.innerHTML = models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('')
  state.model = models[0]
  sel.value = state.model
  sel.onchange = () => {
    state.model = sel.value
    if (state.chat) {
      state.chat.model = state.model
      persistChat()
    }
  }

  const ws = state.session.workspace || ''
  $('workspace-label').textContent = ws
    ? ws.replace(/\\/g, '/').split('/').slice(-3).join('/')
    : 'no workspace'
  $('guest-dot').classList.toggle('on', !!state.session.guestRunning)
  const llmModel = state.session.llmModel
  $('session-meta').innerHTML = [
    `stack: ${esc(state.session.stack)}`,
    state.session.guestRunning ? `guest: ${esc(state.session.guest || 'up')}` : 'guest: off',
    llm ? `llm: ${esc(llm.kind)} · ${esc(llm.model)}` : 'llm: not running — gim start',
    llmModel?.path ? `model: ${esc(llmModel.path)}` : '',
    state.session.kvSlots ? `kv-slots: ${esc(String(state.session.kvSlots))}` : '',
  ]
    .filter(Boolean)
    .join('<br/>')

  document.querySelectorAll('.mode').forEach((b) => {
    b.onclick = () => setMode(b.dataset.mode)
  })
  $('btn-new').onclick = () => newChat()
  $('btn-send').onclick = () => send()
  $('btn-clarify-submit').onclick = () => submitClarify()
  $('btn-clarify-cancel').onclick = () => hideClarify()
  $('btn-attach').onclick = () => $('file-input').click()
  $('file-input').onchange = (e) => attachFiles(e.target.files)
  $('btn-files-refresh').onclick = () => loadFiles(state.filesPath)
  $('btn-context').onclick = () => toggleContextPanel()
  $('btn-context-close').onclick = () => toggleContextPanel(false)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleContextPanel(false)
  })
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  })

  const box = document.querySelector('.composer-box')
  box.addEventListener('dragover', (e) => {
    e.preventDefault()
  })
  box.addEventListener('drop', (e) => {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) attachFiles(e.dataTransfer.files)
  })

  $('input').addEventListener('paste', async (e) => {
    const items = [...(e.clipboardData?.items || [])]
    const files = items.filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean)
    if (files.length) {
      e.preventDefault()
      await attachFiles(files)
    }
  })

  await refreshChats()
  await loadFiles('.').catch(() => {})
  if (state.chats[0]) await openChat(state.chats[0].id)
  else {
    renderThread()
    refreshContext().catch(() => {})
  }
}

boot().catch((err) => {
  $('thread').innerHTML = `<div class="empty"><p>${esc(err.message)}</p></div>`
})
