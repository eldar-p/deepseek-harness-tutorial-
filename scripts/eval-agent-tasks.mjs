/**
 * GIM agent tool eval — run against live UI.
 * Usage: GIM_UI=http://127.0.0.1:7440 node scripts/eval-agent-tasks.mjs
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

const UI = process.env.GIM_UI || 'http://127.0.0.1:7440'
const MODEL = process.env.GIM_MODEL || 'deepseek-v4-flash'
const LOCK = path.join(outDir, 'eval.lock')

function acquireLock() {
  if (fs.existsSync(LOCK)) {
    const who = fs.readFileSync(LOCK, 'utf8').trim()
    throw new Error(`eval already running (${who}) — one sequential run at a time`)
  }
  fs.writeFileSync(LOCK, `${process.pid} @ ${new Date().toISOString()}`)
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK)
  } catch {
    /* */
  }
}
const outDir = path.join(os.tmpdir(), 'gim-eval')
fs.mkdirSync(outDir, { recursive: true })

async function api(pathname, opts = {}) {
  const res = await fetch(`${UI}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`${pathname} ${res.status}: ${t.slice(0, 300)}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

async function consumeSse(res) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let content = ''
  const tools = []
  let clarified = false
  let clarify = null
  let error = null

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
          if (j.type === 'tool_start') tools.push({ name: j.name, args: j.args, result: null })
          if (j.type === 'tool_result') {
            const last = tools[tools.length - 1]
            if (last) last.result = j.result
          }
          if (j.type === 'clarify') {
            clarified = true
            clarify = { title: j.title, questions: j.questions, local: j.local }
          }
          if (j.type === 'error') error = j.error
          continue
        }
        const delta = j.choices?.[0]?.delta?.content || ''
        if (delta) content += delta
      } catch {
        /* */
      }
    }
  }
  return { content, tools, clarified, clarify, error }
}

async function newChat(title, mode = 'agent') {
  return api('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ title, mode, model: MODEL }),
  })
}

async function runTask(task) {
  const chat = await newChat(task.id, task.mode || 'agent')
  const t0 = Date.now()
  const res = await fetch(`${UI}/api/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: task.mode || 'agent',
      model: MODEL,
      chatId: chat.id,
      // Skip runtime probe during eval — Colibri queue chokes on extra requests
      capabilities: { tools: true, streaming: true, openaiCompletions: true },
      messages: [{ role: 'user', content: task.prompt }],
    }),
    signal: AbortSignal.timeout(task.timeoutMs || 900_000),
  })
  if (!res.ok) {
    const t = await res.text()
    return {
      id: task.id,
      label: task.label,
      difficulty: task.difficulty,
      pass: false,
      ms: Date.now() - t0,
      tools: [],
      clarified: false,
      detail: `HTTP ${res.status}: ${t.slice(0, 200)}`,
    }
  }
  const result = await consumeSse(res)
  const ms = Date.now() - t0

  if (result.clarified && result.clarify?.questions?.length && task.autoAnswer !== false) {
    const answers = {}
    for (const q of result.clarify.questions) {
      answers[q.id] = q.options?.[0] || 'go ahead'
    }
    const res2 = await fetch(`${UI}/api/chat/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chat.id,
        mode: task.mode || 'agent',
        model: MODEL,
        answers,
      }),
      signal: AbortSignal.timeout(task.timeoutMs || 600_000),
    })
    if (res2.ok) {
      const follow = await consumeSse(res2)
      result.content += '\n--- after clarify ---\n' + (follow.content || '')
      result.tools.push(...(follow.tools || []))
      if (follow.error) result.error = follow.error
      result.clarified = result.clarified || follow.clarified
    }
  }

  let check = { pass: false, detail: 'no checker' }
  try {
    check = await task.check({ ...result, chatId: chat.id, ms })
  } catch (err) {
    check = { pass: false, detail: err.message }
  }

  return {
    id: task.id,
    label: task.label,
    difficulty: task.difficulty,
    pass: check.pass,
    detail: check.detail,
    ms,
    tools: result.tools.map((t) => t.name),
    clarified: result.clarified,
    contentPreview: (result.content || '').slice(0, 400),
    error: result.error || null,
  }
}

const workspace = path.join(os.homedir(), '.gim', 'workspace', 'default')

const tasks = [
  {
    id: 't01-listdir',
    label: 'list_dir root',
    difficulty: 'L1',
    prompt: 'Use list_dir on "." and list file/folder names. No clarifying questions.',
    check: async ({ tools, content }) => {
      const used = tools.some((t) => t.name === 'list_dir')
      const ok = tools.find((t) => t.name === 'list_dir' && t.result?.ok)
      return {
        pass: used && (ok || content.length > 15),
        detail: used ? `list_dir ok=${!!ok}` : 'no list_dir',
      }
    },
  },
  {
    id: 't02-read',
    label: 'read_file STRUCTURE',
    difficulty: 'L1',
    prompt: 'Use read_file on STRUCTURE.txt and quote the first line. No questions.',
    check: async ({ tools, content }) => {
      const read = tools.some((t) => t.name === 'read_file')
      return {
        pass: read && content.length > 10,
        detail: `read_file=${read} len=${content.length}`,
      }
    },
  },
  {
    id: 't03-write',
    label: 'write_file hello',
    difficulty: 'L1',
    prompt: 'Use write_file to create hello_tool.txt with exactly: eval-ok. No questions.',
    check: async ({ tools }) => {
      const wrote = tools.some((t) => t.name === 'write_file')
      const p = path.join(workspace, 'hello_tool.txt')
      const body = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
      return {
        pass: wrote && body.includes('eval-ok'),
        detail: `write=${wrote} body=${body.slice(0, 40)}`,
      }
    },
  },
  {
    id: 't04-search',
    label: 'search_files GIM',
    difficulty: 'L1',
    prompt: 'Use search_files to find "workspace" or "GIM" in the workspace. Show paths found. No questions.',
    check: async ({ tools, content }) => {
      const s = tools.some((t) => t.name === 'search_files')
      const hit = tools.find((t) => t.name === 'search_files')
      const hasHits = hit?.result?.matches?.length > 0 || /STRUCTURE|\.gim|workspace/i.test(content)
      return { pass: s && hasHits, detail: `search=${s} hits=${hasHits}` }
    },
  },
  {
    id: 't05-guest',
    label: 'guest_bash ls',
    difficulty: 'L1',
    prompt: 'Run guest_bash: ls -la /workspace | head -20. Show output. No questions.',
    check: async ({ tools, content }) => {
      const g = tools.some((t) => t.name === 'guest_bash')
      const out = tools.find((t) => t.name === 'guest_bash')
      const ok = out?.result?.ok || /total|STRUCTURE|\.gim|drwx/i.test(content)
      return { pass: g && ok, detail: `guest_bash=${g} ok=${ok}` }
    },
  },
  {
    id: 't06-askuser',
    label: 'ask_user poll',
    difficulty: 'L1',
    prompt: 'You MUST call ask_user with title "Pick language" and one question with options Python and JavaScript. Do not write options as plain text.',
    check: async ({ tools, clarified, clarify }) => {
      const au = tools.some((t) => t.name === 'ask_user')
      const form = clarified && clarify?.questions?.length
      return {
        pass: au || form,
        detail: `ask_user=${au} clarify_form=${form}`,
      }
    },
  },
  {
    id: 't07-ask-math',
    label: 'Ask mode math',
    difficulty: 'L1',
    mode: 'ask',
    prompt: 'What is 17 * 24? Reply with only the number.',
    check: async ({ content, tools }) => {
      const noTools = !tools.length
      return {
        pass: /\b408\b/.test(content),
        detail: `408=${/\b408\b/.test(content)} noTools=${noTools}`,
      }
    },
  },
  {
    id: 't08-search-read',
    label: 'search → read combo',
    difficulty: 'L2',
    prompt: '1) search_files for STRUCTURE 2) read_file STRUCTURE.txt 3) one sentence summary. No questions.',
    check: async ({ tools, content }) => {
      const s = tools.some((t) => t.name === 'search_files')
      const r = tools.some((t) => t.name === 'read_file')
      return { pass: s && r && content.length > 20, detail: `search=${s} read=${r}` }
    },
  },
  {
    id: 't09-write-run',
    label: 'write calc + guest run',
    difficulty: 'L2',
    prompt:
      'Create calc_eval.py: reads two ints from stdin, prints sum. Use write_file. Then guest_bash: echo "2 3" | python3 /workspace/calc_eval.py — must print 5. No questions.',
    check: async ({ tools }) => {
      const w = tools.some((t) => t.name === 'write_file')
      const g = tools.some((t) => t.name === 'guest_bash')
      const gr = tools.find((t) => t.name === 'guest_bash')
      const out = JSON.stringify(gr?.result || '')
      return {
        pass: w && g && /5/.test(out),
        detail: `write=${w} guest=${g} out=${out.slice(0, 80)}`,
      }
    },
  },
  {
    id: 't10-plan',
    label: 'Plan mode no write',
    difficulty: 'L2',
    mode: 'plan',
    prompt: 'Plan a CLI todo app in 5 numbered steps. Do NOT write any files.',
    check: async ({ tools, content }) => {
      const wrote = tools.some((t) => t.name === 'write_file')
      const steps = (content.match(/\d+[.)]/g) || []).length >= 3
      return { pass: !wrote && steps, detail: `write=${wrote} steps=${steps}` }
    },
  },
  {
    id: 't11-hard-notes',
    label: 'search read write EVAL_NOTES',
    difficulty: 'L3',
    prompt:
      '1) search_files STRUCTURE 2) read_file STRUCTURE.txt 3) write_file EVAL_NOTES.md with 5 lines: project=GIM, fact from file, date=2026-08-24, status=eval-ok, author=gim. No questions.',
    check: async ({ tools }) => {
      const s = tools.some((t) => t.name === 'search_files')
      const r = tools.some((t) => t.name === 'read_file')
      const w = tools.some((t) => t.name === 'write_file')
      const p = path.join(workspace, 'EVAL_NOTES.md')
      const body = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
      const ok = body.includes('eval-ok') && body.includes('GIM')
      return { pass: s && r && w && ok, detail: `s=${s} r=${r} w=${w} file=${ok}` }
    },
  },
  {
    id: 't12-missing-file',
    label: 'read missing file',
    difficulty: 'L3',
    prompt: 'Use read_file on no_such_file_xyz.txt. Report the error honestly. No questions.',
    check: async ({ tools, content }) => {
      const read = tools.some((t) => t.name === 'read_file')
      const err = tools.find((t) => t.name === 'read_file')
      const honest = err?.result?.ok === false || /not found|missing|error|no such/i.test(content)
      return { pass: read && honest, detail: `read=${read} honest=${honest}` }
    },
  },
]

console.log(`GIM eval UI=${UI} model=${MODEL}`)
acquireLock()
process.on('exit', releaseLock)
process.on('SIGINT', () => {
  releaseLock()
  process.exit(130)
})

try {
const health = await api('/api/health')
console.log('health', health)

const report = []
for (const task of tasks) {
  process.stdout.write(`\n>>> [${task.difficulty}] ${task.label}\n`)
  if (report.length) await new Promise((r) => setTimeout(r, 8000))
  try {
    const r = await runTask(task)
    report.push(r)
    console.log(
      `${r.pass ? 'PASS' : 'FAIL'} (${Math.round(r.ms / 1000)}s) tools=[${r.tools.join(',')}] clarify=${r.clarified} — ${r.detail}`,
    )
    if (r.error) console.log('  error:', r.error)
    if (!r.pass) console.log('  preview:', (r.contentPreview || '').replace(/\s+/g, ' ').slice(0, 180))
  } catch (err) {
    report.push({
      id: task.id,
      label: task.label,
      difficulty: task.difficulty,
      pass: false,
      detail: err.message,
      ms: 0,
      tools: [],
    })
    console.log('FAIL —', err.message)
  }
}

const summary = {
  at: new Date().toISOString(),
  ui: UI,
  model: MODEL,
  passed: report.filter((r) => r.pass).length,
  total: report.length,
  report,
}
const out = path.join(outDir, `report-${Date.now()}.json`)
fs.writeFileSync(out, JSON.stringify(summary, null, 2))
console.log('\n==== SUMMARY ====')
console.log(`${summary.passed}/${summary.total} passed`)
for (const r of report) {
  console.log(`- [${r.difficulty}] ${r.pass ? 'PASS' : 'FAIL'} ${r.label}: ${r.detail}`)
}
console.log('saved', out)
} finally {
  releaseLock()
}
