/**
 * Honest GIM eval — messy user prompts (typos, no tool names, RU/EN mix).
 * One task at a time. Usage:
 *   GIM_UI=http://127.0.0.1:7545 GIM_MODEL=deepseek-v4-flash node scripts/honest-eval.mjs
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

const UI = process.env.GIM_UI || 'http://127.0.0.1:7545'
const MODEL = process.env.GIM_MODEL || 'deepseek-v4-flash'
const outDir = path.join(os.tmpdir(), 'gim-honest-eval')
const LOCK = path.join(outDir, 'honest.lock')
fs.mkdirSync(outDir, { recursive: true })

function acquireLock() {
  if (fs.existsSync(LOCK)) throw new Error(`locked: ${fs.readFileSync(LOCK, 'utf8')}`)
  fs.writeFileSync(LOCK, `${process.pid} ${new Date().toISOString()}`)
}
function releaseLock() {
  try {
    fs.unlinkSync(LOCK)
  } catch {
    /* */
  }
}

async function api(p, opts = {}) {
  const res = await fetch(`${UI}${p}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) throw new Error(`${p} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.headers.get('content-type')?.includes('json') ? res.json() : res
}

async function consumeSse(res) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = '',
    content = '',
    tools = [],
    clarified = false,
    clarify = null,
    error = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
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
            const last = tools.at(-1)
            if (last) last.result = j.result
          }
          if (j.type === 'clarify') {
            clarified = true
            clarify = j
          }
          if (j.type === 'error') error = j.error
          continue
        }
        const d = j.choices?.[0]?.delta?.content || ''
        if (d) content += d
      } catch {
        /* */
      }
    }
  }
  return { content, tools, clarified, clarify, error }
}

async function runTurn({ chatId, mode, prompt, autoClarify = true }) {
  const t0 = Date.now()
  const res = await fetch(`${UI}/api/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      model: MODEL,
      chatId,
      capabilities: { tools: true, streaming: true, openaiCompletions: true },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(900_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  let out = await consumeSse(res)
  if (autoClarify && out.clarified && out.clarify?.questions?.length) {
    const answers = {}
    for (const q of out.clarify.questions) answers[q.id] = q.options?.[0] || 'да'
    const r2 = await fetch(`${UI}/api/chat/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, mode, model: MODEL, answers }),
      signal: AbortSignal.timeout(900_000),
    })
    if (r2.ok) {
      const follow = await consumeSse(r2)
      out.content += '\n---\n' + follow.content
      out.tools.push(...follow.tools)
      if (follow.error) out.error = follow.error
    }
  }
  out.ms = Date.now() - t0
  return out
}

const workspace = path.join(os.homedir(), '.gim', 'workspace', 'default')

/** @type {Array<{id:string,label:string,prompt:string,mode?:string,check:Function}>} */
const tasks = [
  {
    id: 'h01',
    label: 'vague list folder',
    prompt: 'привет чекни что тут в папке лежит',
    check: async ({ tools, content }) => {
      const ok = tools.some((t) => t.name === 'list_dir') || /STRUCTURE|\.gim|logs|gitignore/i.test(content)
      return { pass: ok, detail: ok ? 'listed something real' : 'no dir listing' }
    },
  },
  {
    id: 'h02',
    label: 'rpg game messy',
    prompt: 'напиши мне лёгкую пайтон игру rpg',
    check: async ({ tools, content }) => {
      const wrote = tools.some((t) => t.name === 'write_file')
      const p = path.join(workspace, 'mini_rpg.py')
      const alt = fs.readdirSync(workspace).find((f) => /rpg|game/i.test(f) && f.endsWith('.py'))
      const fp = alt ? path.join(workspace, alt) : p
      const exists = fs.existsSync(fp)
      const body = exists ? fs.readFileSync(fp, 'utf8') : ''
      const ok =
        wrote &&
        exists &&
        body.length > 60 &&
        /print|hp|attack|monster|input/i.test(body)
      return { pass: ok, detail: ok ? `file ${path.basename(fp)} ${body.length}b` : `wrote=${wrote} exists=${exists}` }
    },
  },
  {
    id: 'h03',
    label: 'structure vague',
    prompt: 'найди structure txt и в двух словах чё за проект',
    check: async ({ tools, content }) => {
      const used = tools.some((t) => ['search_files', 'read_file', 'list_dir'].includes(t.name))
      const ok = used && content.length > 15 && !/would you like|выбери 1/i.test(content.slice(-200))
      return { pass: ok, detail: `tools=${tools.map((t) => t.name).join(',')} len=${content.length}` }
    },
  },
  {
    id: 'h04',
    label: 'docker ls messy',
    prompt: 'запусти ls в докере чтоб увидеть workspace',
    check: async ({ tools, content }) => {
      const g = tools.find((t) => t.name === 'guest_bash')
      const ok = g && (g.result?.ok || /total|STRUCTURE|workspace|\.gim/i.test(content + JSON.stringify(g.result)))
      return { pass: !!ok, detail: g ? JSON.stringify(g.result).slice(0, 80) : 'no guest_bash' }
    },
  },
  {
    id: 'h05',
    label: 'math sloppy ask',
    mode: 'ask',
    prompt: 'сколько 17*24?? только число',
    check: async ({ content, tools }) => {
      const ok = /\b408\b/.test(content) && tools.length === 0
      return { pass: ok, detail: content.slice(0, 40) }
    },
  },
  {
    id: 'h06',
    label: 'calc sloppy combo',
    prompt: 'сделай calc.py чтоб два числа складывал и проверь 2+3=5 в госте',
    check: async ({ tools }) => {
      const w = tools.some((t) => t.name === 'write_file')
      const g = tools.find((t) => t.name === 'guest_bash')
      const py = fs.readdirSync(workspace).find((f) => /calc/i.test(f) && f.endsWith('.py'))
      const out = JSON.stringify(g?.result || '')
      const ok = w && g && (py || out.includes('5'))
      return { pass: ok, detail: `write=${w} guest=${!!g} py=${py || '-'} out=${out.slice(0, 60)}` }
    },
  },
  {
    id: 'h07',
    label: 'menu then answer 4',
    prompt: 'list_dir .',
    check: async ({ tools, content, chatId }, run) => {
      if (!tools.some((t) => t.name === 'list_dir')) {
        return { pass: false, detail: 'no list_dir on first turn' }
      }
      // second turn: user picks "4" like real chat
      const r2 = await runTurn({ chatId, mode: 'agent', prompt: '4', autoClarify: false })
      const notLoop = !/would you like|выбери|1\.|2\.|3\.|4\./i.test(r2.content.slice(0, 300))
      const didSomething = r2.tools.length > 0 || r2.content.length > 30
      return { pass: didSomething && notLoop, detail: `tools2=${r2.tools.map((t) => t.name)} loop=${!notLoop}` }
    },
  },
  {
    id: 'h08',
    label: 'ambiguous choice',
    prompt: 'хз python или js для скрипта — сам не решай',
    check: async ({ clarified, tools, content }) => {
      const asked = tools.some((t) => t.name === 'ask_user') || clarified
      const bad = /я выбрал|going with python|буду python/i.test(content) && !asked
      return { pass: asked && !bad, detail: `ask=${asked} invented=${bad}` }
    },
  },
]

console.log('=== HONEST EVAL (messy prompts) ===', UI, MODEL)
acquireLock()
process.on('exit', releaseLock)

const report = []
try {
  await api('/api/health')
  for (const task of tasks) {
    if (report.length) await new Promise((r) => setTimeout(r, 10_000))
    process.stdout.write(`\n>> ${task.label}\n   prompt: "${task.prompt.slice(0, 60)}..."\n`)
    const chat = await api('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ title: task.id, mode: task.mode || 'agent', model: MODEL }),
    })
    try {
      const result = await runTurn({ chatId: chat.id, mode: task.mode || 'agent', prompt: task.prompt })
      const check = await task.check(result, runTurn)
      const row = {
        id: task.id,
        label: task.label,
        prompt: task.prompt,
        pass: check.pass,
        detail: check.detail,
        ms: result.ms,
        tools: result.tools.map((t) => t.name),
        clarified: result.clarified,
        preview: result.content.slice(0, 200),
        error: result.error,
      }
      report.push(row)
      console.log(`   ${row.pass ? 'PASS' : 'FAIL'} ${Math.round(row.ms / 1000)}s [${row.tools}] — ${row.detail}`)
      if (row.error) console.log('   err:', String(row.error).slice(0, 120))
    } catch (err) {
      report.push({ id: task.id, label: task.label, pass: false, detail: err.message, prompt: task.prompt })
      console.log('   FAIL —', err.message)
    }
  }
} finally {
  releaseLock()
}

const summary = {
  at: new Date().toISOString(),
  ui: UI,
  model: MODEL,
  passed: report.filter((r) => r.pass).length,
  total: report.length,
  report,
}
const out = path.join(outDir, `honest-${Date.now()}.json`)
fs.writeFileSync(out, JSON.stringify(summary, null, 2))
console.log(`\n==== ${summary.passed}/${summary.total} PASS ====`)
for (const r of report) console.log(`${r.pass ? '✓' : '✗'} ${r.label}: ${r.detail}`)
console.log('saved', out)
