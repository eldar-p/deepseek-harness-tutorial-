#!/usr/bin/env node
/** Live AI + guest probe against a running GIM stack. */
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, engineEnv } from '../src/detect.js'
import { readRunState } from '../src/runstate.js'

const stack = process.argv.find((a) => a.startsWith('--stack='))?.split('=')[1] || 'default'
const run = readRunState(stack)
if (!run?.urls?.llama) {
  console.error('no running stack')
  process.exit(2)
}
const llama = run.urls.llama.replace(/\/$/, '')
const engine = detectContainerEngine()
if (!engine.ok) {
  console.error('engine:', engine.detail)
  process.exit(1)
}
const env = engineEnv(engine.bin)
const guest = run.guestName || `gim-guest-${stack}`

function dex(...args) {
  const r = spawnSync(engine.bin, ['exec', guest, ...args], {
    encoding: 'utf8',
    env,
    windowsHide: true,
  })
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

async function chat(content, extra = {}) {
  const r = await fetch(`${llama}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'coder',
      temperature: 0,
      max_tokens: 160,
      messages: [{ role: 'user', content }],
      ...extra,
    }),
  })
  const j = await r.json()
  return j.choices?.[0] || {}
}

const results = []
function note(id, ok, detail) {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} — ${detail}`)
}

// 1 free-form bash → guest
{
  const c = await chat(
    '/no_think\nOne bash line: write PASS-AI to /workspace/ai-smoke.txt and cat it. No markdown.',
  )
  const cmd = String(c.message?.content || '')
    .trim()
    .split('\n')[0]
    .replace(/```/g, '')
  const runCmd = dex('bash', '-lc', cmd)
  const ver = dex('bash', '-lc', 'cat /workspace/ai-smoke.txt 2>&1')
  const ok = ver.out.includes('PASS-AI')
  note('guest-bash-from-model', ok, `cmd=${JSON.stringify(cmd)} out=${JSON.stringify(ver.out.trim())} status=${runCmd.status}`)
}

// 2 typo stress
{
  const c = await chat(
    '/no_think\nOne bash line creating /workspace/ai-smoke2.txt with OK then cat the same path. No markdown.',
  )
  const cmd = String(c.message?.content || '').trim().split('\n')[0]
  const typo = /ai-smone|smokee|ai-smok[^e2.\s]/.test(cmd)
  const runCmd = dex('bash', '-lc', cmd)
  const ver = dex('bash', '-lc', 'cat /workspace/ai-smoke2.txt 2>&1')
  note(
    'path-typo-stress',
    !typo && ver.out.includes('OK'),
    `cmd=${JSON.stringify(cmd)} typo=${typo} out=${JSON.stringify(ver.out.trim())}`,
  )
}

// 3 code confusion
{
  const c = await chat(
    `/no_think
a.js exports only foo.
b.js: import { foo } from './a.js'; console.log(foo()+bar());
1) Name the undefined symbol only.
2) Minimal fix for b.js that does NOT invent bar from a.js.`,
  )
  const text = String(c.message?.content || '')
  const namesBar = /\bbar\b/i.test(text)
  const inventsImport = /import\s*\{\s*bar\s*\}/i.test(text)
  note(
    'code-no-invent-import',
    namesBar && !inventsImport,
    text.replace(/\s+/g, ' ').slice(0, 220),
  )
}

// 4 tool order
{
  const tools = [
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
        name: 'read_file',
        description: 'Read file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    },
  ]
  const c = await chat(
    "/no_think\nYou MUST call list_dir on '.' first only. Do not call read_file yet.",
    { tools, tool_choice: 'auto', max_tokens: 120 },
  )
  const calls = c.message?.tool_calls || []
  const names = calls.map((t) => t.function?.name)
  note(
    'tool-order-list-first',
    names.length >= 1 && names[0] === 'list_dir' && !names.includes('read_file'),
    JSON.stringify(names),
  )
}

// 5 refuse fake tool (already known) + DONE format after tool loop briefly skipped

const failed = results.filter((r) => !r.ok)
console.log('')
console.log(failed.length ? `PROBE FAIL ${failed.length}/${results.length}` : `PROBE PASS ${results.length}/${results.length}`)
process.exit(failed.length ? 1 : 0)
