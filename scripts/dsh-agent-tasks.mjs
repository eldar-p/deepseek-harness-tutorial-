#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, engineEnv } from '../src/detect.js'
import { readRunState } from '../src/runstate.js'
import { paths } from '../src/paths.js'

const stack = 'default'
const run = readRunState(stack)
if (!run?.urls?.llama) {
  console.error('stack not running')
  process.exit(2)
}
const llama = run.urls.llama.replace(/\/$/, '')
const hostWs = paths(stack).workspace
const engine = detectContainerEngine()
const env = engineEnv(engine.bin)
const guest = run.guestName || `gim-guest-${stack}`

function dex(cmd) {
  return spawnSync(engine.bin, ['exec', guest, 'bash', '-lc', cmd], {
    encoding: 'utf8',
    env,
    windowsHide: true,
  })
}

function relPath(p) {
  return String(p || '')
    .replace(/^[/\\]?workspace[/\\]?/i, '')
    .replace(/^\.\//, '')
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read workspace file',
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
      description: 'Write workspace file',
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
      description: 'Run bash in /workspace',
      parameters: {
        type: 'object',
        properties: { cmd: { type: 'string' } },
        required: ['cmd'],
      },
    },
  },
]

async function chat(messages) {
  const r = await fetch(`${llama}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'coder',
      temperature: 0,
      max_tokens: 500,
      tools,
      tool_choice: 'auto',
      messages,
    }),
  })
  const j = await r.json()
  if (!j.choices?.[0]) throw new Error(JSON.stringify(j).slice(0, 300))
  return j.choices[0]
}

async function runTask(label, prompt) {
  console.log(`\n=== ${label} ===`)
  const messages = [
    {
      role: 'system',
      content:
        'You are a coding agent. Always use tools. Paths are relative to /workspace. Prefer small precise edits.',
    },
    { role: 'user', content: `/no_think\n${prompt}` },
  ]
  for (let i = 0; i < 8; i++) {
    const c = await chat(messages)
    const msg = c.message || {}
    console.log(`round ${i} finish=${c.finish_reason} text=${String(msg.content || '').slice(0, 100)}`)
    if (c.finish_reason === 'stop' && !msg.tool_calls?.length) {
      console.log('FINAL:', msg.content)
      return String(msg.content || '')
    }
    const tcs = msg.tool_calls || []
    messages.push({ role: 'assistant', content: msg.content || '', tool_calls: tcs })
    for (const tc of tcs) {
      const name = tc.function.name
      let args = {}
      try {
        args = JSON.parse(tc.function.arguments || '{}')
      } catch {
        args = {}
      }
      let result = ''
      if (name === 'read_file') {
        const p = path.join(hostWs, relPath(args.path))
        result = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : `ERR missing ${args.path}`
      } else if (name === 'write_file') {
        const p = path.join(hostWs, relPath(args.path))
        fs.mkdirSync(path.dirname(p), { recursive: true })
        fs.writeFileSync(p, args.content, 'utf8')
        result = `OK wrote ${args.path}`
      } else if (name === 'run_bash') {
        const r = dex(`cd /workspace && ${args.cmd}`)
        result = `${r.stdout || ''}${r.stderr || ''}\nstatus=${r.status}`
      } else result = `unknown tool ${name}`
      console.log(`tool ${name} -> ${String(result).replace(/\s+/g, ' ').slice(0, 140)}`)
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name,
        content: String(result).slice(0, 4000),
      })
    }
  }
  return 'MAX_ROUNDS'
}

await runTask(
  'task-hello',
  'Read tasks/hello.js. Implement greet(name) returning Hello, ${name}!. Write the file. Run: node tasks/hello.test.js. When it prints ok, reply DONE.',
)
await runTask(
  'task-readme',
  'Create tasks/README.md with one sentence describing greet(). Do not invent other APIs. Reply DONE.',
)
console.log('\nhello.js=\n' + fs.readFileSync(path.join(hostWs, 'tasks/hello.js'), 'utf8'))
