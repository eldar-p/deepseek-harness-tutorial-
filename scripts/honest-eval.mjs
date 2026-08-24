/**

 * Honest GIM eval — messy prompts + adversarial patterns from real agent incidents.

 * Usage:

 *   GIM_UI=http://127.0.0.1:7545 GIM_MODEL=deepseek-v4-flash node scripts/honest-eval.mjs

 *   node scripts/honest-eval.mjs --mode=adversarial

 *   node scripts/honest-eval.mjs --mode=usefulness

 */

import fs from 'fs'

import path from 'path'

import os from 'os'

import {

  selectHonestTasks,

  defaultWorkspace,

  HONEST_EVAL_BAR,

  HONEST_ADVERSARIAL_BAR,

} from '../src/honest-eval-tasks.js'



const UI = process.env.GIM_UI || 'http://127.0.0.1:7545'

const MODEL = process.env.GIM_MODEL || 'deepseek-v4-flash'

const STACK = process.env.GIM_STACK || 'default'

const modeArg = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] || process.env.GIM_HONEST_MODE || 'all'

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



const tasks = selectHonestTasks(modeArg)

const workspace = defaultWorkspace(STACK)



console.log('=== HONEST EVAL ===', UI, MODEL, `mode=${modeArg}`, `tasks=${tasks.length}`)

acquireLock()

process.on('exit', releaseLock)



const report = []

try {

  await api('/api/health')

  for (const task of tasks) {

    if (report.length) await new Promise((r) => setTimeout(r, 10_000))

    task.setup?.(workspace)

    process.stdout.write(`\n>> [${task.category || 'task'}] ${task.label}\n   prompt: "${task.prompt.slice(0, 60)}..."\n`)

    if (task.source) process.stdout.write(`   source: ${task.source}\n`)

    const chat = await api('/api/chats', {

      method: 'POST',

      body: JSON.stringify({ title: task.id, mode: task.mode || 'agent', model: MODEL }),

    })

    try {

      const result = await runTurn({ chatId: chat.id, mode: task.mode || 'agent', prompt: task.prompt })

      let check = await task.check(result, runTurn, workspace)

      if (result.error) {

        check = { pass: false, detail: `agent error: ${String(result.error).slice(0, 120)}` }

      }

      const row = {

        id: task.id,

        label: task.label,

        category: task.category,

        source: task.source,

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

      report.push({

        id: task.id,

        label: task.label,

        category: task.category,

        pass: false,

        detail: err.message,

        prompt: task.prompt,

      })

      console.log('   FAIL —', err.message)

    } finally {

      task.teardown?.(workspace)

    }

  }

} finally {

  releaseLock()

}



const usefulness = report.filter((r) => r.id.startsWith('h'))

const adversarial = report.filter((r) => r.id.startsWith('a'))

const usePass = usefulness.filter((r) => r.pass).length

const advPass = adversarial.filter((r) => r.pass).length

const useRate = usefulness.length ? usePass / usefulness.length : 1

const advRate = adversarial.length ? advPass / adversarial.length : 1

const totalPass = report.filter((r) => r.pass).length



const summary = {

  at: new Date().toISOString(),

  ui: UI,

  model: MODEL,

  mode: modeArg,

  passed: totalPass,

  total: report.length,

  usefulness: { passed: usePass, total: usefulness.length, rate: useRate },

  adversarial: { passed: advPass, total: adversarial.length, rate: advRate },

  report,

}

const out = path.join(outDir, `honest-${Date.now()}.json`)

fs.writeFileSync(out, JSON.stringify(summary, null, 2))



console.log(`\n==== ${totalPass}/${report.length} PASS ====`)

if (usefulness.length) console.log(`usefulness: ${usePass}/${usefulness.length} (${Math.round(useRate * 100)}%) bar=${Math.round(HONEST_EVAL_BAR * 100)}%`)

if (adversarial.length) console.log(`adversarial: ${advPass}/${adversarial.length} (${Math.round(advRate * 100)}%) bar=${Math.round(HONEST_ADVERSARIAL_BAR * 100)}%`)

for (const r of report) console.log(`${r.pass ? '✓' : '✗'} ${r.id} ${r.label}: ${r.detail}`)

console.log('saved', out)



let ok = true

if (usefulness.length && useRate < HONEST_EVAL_BAR) ok = false

if (adversarial.length && advRate < HONEST_ADVERSARIAL_BAR) ok = false

if (!ok) {

  console.error('FAIL: honest-eval below bar')

  process.exit(1)

}


