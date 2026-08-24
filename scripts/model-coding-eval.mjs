#!/usr/bin/env node
/**
 * Score tool-calling + coding quality of the running llama stack.
 * Usage: node scripts/model-coding-eval.mjs [--label=NAME] [--stack=default]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, engineEnv } from '../src/detect.js'
import { readRunState } from '../src/runstate.js'
import { paths } from '../src/paths.js'

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] || d
const stack = arg('stack', 'default')
const label = arg('label', 'current')
const run = readRunState(stack)
if (!run?.urls?.llama) {
  console.error('no running stack')
  process.exit(2)
}
const llama = run.urls.llama.replace(/\/$/, '')
const hostWs = paths(stack).workspace
const engine = detectContainerEngine()
const env = engineEnv(engine.bin)
const guest = run.guestName || `gim-guest-${stack}`
const workDir = path.join(hostWs, `_eval_${label.replace(/[^\w.-]+/g, '_')}`)
fs.mkdirSync(workDir, { recursive: true })

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a workspace-relative file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a workspace-relative file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_bash',
      description: 'Run bash (cwd=/workspace)',
      parameters: {
        type: 'object',
        properties: { cmd: { type: 'string' } },
        required: ['cmd'],
      },
    },
  },
]

function hostPath(rel) {
  const clean = String(rel || '')
    .replace(/^[/\\]?workspace[/\\]?/i, '')
    .replace(/^\.\//, '')
  return path.join(hostWs, clean)
}

function execTool(name, args) {
  if (name === 'read_file') {
    const p = hostPath(args.path)
    if (!fs.existsSync(p)) return `ERROR: missing ${args.path}`
    return fs.readFileSync(p, 'utf8')
  }
  if (name === 'write_file') {
    const p = hostPath(args.path)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, args.content ?? '', 'utf8')
    return `OK wrote ${args.path} (${Buffer.byteLength(args.content ?? '')} bytes)`
  }
  if (name === 'run_bash') {
    const r = spawnSync(engine.bin, ['exec', '-w', '/workspace', guest, 'bash', '-lc', args.cmd], {
      encoding: 'utf8',
      env,
      windowsHide: true,
      timeout: 20000,
    })
    return `status=${r.status}\n${r.stdout || ''}${r.stderr || ''}`.slice(0, 4000)
  }
  return `ERROR: unknown tool ${name}`
}

async function chat(messages, extra = {}) {
  const r = await fetch(`${llama}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'coder',
      temperature: 0,
      max_tokens: 700,
      tools,
      tool_choice: 'auto',
      messages,
      ...extra,
    }),
  })
  const j = await r.json()
  if (!j.choices?.[0]) throw new Error(JSON.stringify(j).slice(0, 400))
  return j.choices[0]
}

async function toolLoop(system, user, maxTurns = 8) {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const toolLog = []
  for (let i = 0; i < maxTurns; i++) {
    const choice = await chat(messages)
    const msg = choice.message || {}
    messages.push(msg)
    const calls = msg.tool_calls || []
    if (!calls.length) {
      return { messages, final: String(msg.content || ''), toolLog, turns: i + 1 }
    }
    for (const call of calls) {
      let args = {}
      try {
        args = JSON.parse(call.function?.arguments || '{}')
      } catch {
        args = {}
      }
      const out = execTool(call.function?.name, args)
      toolLog.push({ name: call.function?.name, args, out: out.slice(0, 200) })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: out,
      })
    }
  }
  return { messages, final: '', toolLog, turns: maxTurns }
}

const scores = []
function score(id, pts, max, detail) {
  scores.push({ id, pts, max, detail: String(detail).slice(0, 280) })
  console.log(`${pts}/${max}  ${id} — ${detail}`.slice(0, 220))
}

const SYS =
  '/no_think\nYou are a coding agent. Use tools to read/write/run. Prefer ESM. Do not invent exports. When done, reply DONE.'

// --- A: tool discipline ---
{
  const toolsOnly = [
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List directory',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_all',
        description: 'FORBIDDEN fake tool',
        parameters: { type: 'object', properties: {} },
      },
    },
  ]
  const c = await chat(
    [
      {
        role: 'user',
        content: "/no_think\nCall ONLY list_dir on '.' . Do not call delete_all.",
      },
    ],
    { tools: toolsOnly, max_tokens: 120 },
  )
  const names = (c.message?.tool_calls || []).map((t) => t.function?.name)
  const ok = names.length >= 1 && names[0] === 'list_dir' && !names.includes('delete_all')
  score('tool-discipline', ok ? 2 : 0, 2, JSON.stringify(names))
}

// --- B: no invent import ---
{
  const c = await chat(
    [
      {
        role: 'user',
        content: `/no_think
a.js exports only foo.
b.js has: import { foo } from './a.js'; console.log(foo()+bar());
1) Name the undefined symbol.
2) Minimal fix for b.js that does NOT invent bar from a.js.`,
      },
    ],
    { tools: undefined, tool_choice: undefined, max_tokens: 200 },
  )
  const text = String(c.message?.content || '')
  const invents = /import\s*\{\s*[^}]*\bbar\b/i.test(text)
  const namesBar = /\bbar\b/i.test(text)
  score('code-no-invent', namesBar && !invents ? 2 : invents ? 0 : 1, 2, text.replace(/\s+/g, ' ').slice(0, 180))
}

// --- C: implement add(a,b) via tools ---
{
  const rel = `_eval_${label.replace(/[^\w.-]+/g, '_')}/sum.mjs`
  const abs = hostPath(rel)
  try {
    fs.unlinkSync(abs)
  } catch {
    /* */
  }
  const r = await toolLoop(
    SYS,
    `Create ${rel} exporting function add(a,b) returning a+b. Then run: node ${rel} with a tiny inline test OR write a second test file and run it. Prefer node on host path if guest has no node — still write correct ESM. DONE when file exists.`,
  )
  let pts = 0
  let detail = ''
  if (fs.existsSync(abs)) {
    pts += 1
    const src = fs.readFileSync(abs, 'utf8')
    const usedTools = r.toolLog.some((t) => t.name === 'write_file')
    if (usedTools) pts += 1
    // execute on host node
    const runner = path.join(workDir, '_run_sum.mjs')
    fs.writeFileSync(
      runner,
      `import { add } from ${JSON.stringify(pathToFileURL(abs).href)};\n` +
        `if (add(2,3)!==5) { console.error('BAD', add(2,3)); process.exit(1) }\n` +
        `console.log('PASS')\n`,
    )
    const runHost = spawnSync(process.execPath, [runner], { encoding: 'utf8', timeout: 10000 })
    if (runHost.status === 0 && (runHost.stdout || '').includes('PASS')) pts += 2
    else detail = `runFail ${(runHost.stderr || runHost.stdout || '').slice(0, 120)} src=${src.slice(0, 80)}`
    if (!detail) detail = `tools=${r.toolLog.map((t) => t.name).join(',')} turns=${r.turns}`
  } else {
    detail = `no file tools=${JSON.stringify(r.toolLog.map((t) => t.name))} final=${r.final.slice(0, 100)}`
  }
  score('impl-add-esm', pts, 4, detail)
}

// --- D: fix broken require/ESM mix ---
{
  const dirRel = `_eval_${label.replace(/[^\w.-]+/g, '_')}/mix`
  const dir = hostPath(dirRel)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'lib.mjs'), 'export function mul(a,b){ return a*b }\n')
  fs.writeFileSync(
    path.join(dir, 'main.js'),
    "const { mul } = require('./lib.mjs');\nconsole.log(mul(3,4));\n",
  )
  const r = await toolLoop(
    SYS,
    `In ${dirRel}/ the main.js uses require on an ESM .mjs file (broken). Fix so node can run the entry and print 12. Keep mul in lib. Prefer converting main to ESM import. Do not invent APIs.`,
  )
  let pts = 0
  const main = fs.existsSync(path.join(dir, 'main.mjs'))
    ? path.join(dir, 'main.mjs')
    : path.join(dir, 'main.js')
  const src = fs.existsSync(main) ? fs.readFileSync(main, 'utf8') : ''
  if (/import\s*\{?\s*mul/.test(src) || /from\s+['"].*lib/.test(src)) pts += 1
  if (!/require\s*\(/.test(src)) pts += 1
  const runHost = spawnSync(process.execPath, [main], { encoding: 'utf8', timeout: 10000 })
  if (runHost.status === 0 && String(runHost.stdout).trim() === '12') pts += 2
  score(
    'fix-cjs-esm-mix',
    pts,
    4,
    `out=${JSON.stringify(String(runHost.stdout || runHost.stderr).trim().slice(0, 80))} tools=${r.toolLog.map((t) => t.name).join(',')}`,
  )
}

// --- E: multi-file + parallel tools preference ---
{
  const base = `_eval_${label.replace(/[^\w.-]+/g, '_')}/pkg`
  const r = await toolLoop(
    SYS,
    `Create ${base}/math.mjs with export function clamp(n,lo,hi). Create ${base}/use.mjs that imports clamp and prints clamp(15,0,10) which must be 10. Use tools. DONE when both exist.`,
  )
  let pts = 0
  const mathP = hostPath(`${base}/math.mjs`)
  const useP = hostPath(`${base}/use.mjs`)
  if (fs.existsSync(mathP)) pts += 1
  if (fs.existsSync(useP)) pts += 1
  if (fs.existsSync(useP)) {
    const runHost = spawnSync(process.execPath, [useP], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: path.dirname(useP),
    })
    if (runHost.status === 0 && String(runHost.stdout).trim() === '10') pts += 2
  }
  const writes = r.toolLog.filter((t) => t.name === 'write_file').length
  score('multi-file-clamp', pts, 4, `writes=${writes} turns=${r.turns}`)
}

const total = scores.reduce((s, x) => s + x.pts, 0)
const max = scores.reduce((s, x) => s + x.max, 0)
const report = {
  label,
  stack,
  llama,
  when: new Date().toISOString(),
  host: os.hostname(),
  total,
  max,
  pct: Math.round((100 * total) / max),
  scores,
}
const outPath = path.join(workDir, 'report.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
console.log('')
console.log(`SCORE ${label}: ${total}/${max} (${report.pct}%)  → ${outPath}`)
process.exit(total >= Math.ceil(max * 0.5) ? 0 : 1)
