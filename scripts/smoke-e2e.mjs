#!/usr/bin/env node
/**
 * End-to-end smoke against a running stack (no chat UI automation).
 * Checks: run state, jail patch, guest net env, llama+DSH HTTP, guest bash.
 *
 * Usage: node scripts/smoke-e2e.mjs [--stack=default]
 * Exit 0 = PASS (or local SKIP if stack down), 1 = FAIL / CI without stack.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { paths } from '../src/paths.js'
import { readRunState } from '../src/runstate.js'
import { detectContainerEngine, engineEnv } from '../src/detect.js'
import { isPidAlive } from '../src/proc.js'

const stack = process.argv.find((a) => a.startsWith('--stack='))?.split('=')[1] || 'default'
const failures = []
const notes = []

function ok(msg) {
  console.log(`[PASS] ${msg}`)
}
function fail(msg) {
  failures.push(msg)
  console.error(`[FAIL] ${msg}`)
}
function info(msg) {
  notes.push(msg)
  console.log(`[INFO] ${msg}`)
}

async function httpOk(url, { timeoutMs = 5000 } = {}) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ac.signal })
    return r.ok || (r.status >= 200 && r.status < 500)
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  console.log(`[e2e] stack=${stack}`)
  const run = readRunState(stack)
  if (!run?.urls?.llama || !run?.pids?.llama) {
    // Local: skip cleanly (not a product failure). CI: fail — e2e needs a live stack job.
    console.log('[SKIP] no running stack — run `deep start` then smoke:e2e')
    process.exit(process.env.CI ? 1 : 0)
  }

  if (!isPidAlive(run.pids.llama)) fail(`llama pid ${run.pids.llama} dead`)
  else ok(`llama pid ${run.pids.llama}`)

  if (run.pids?.dsh) {
    if (!isPidAlive(run.pids.dsh)) fail(`dsh pid ${run.pids.dsh} dead`)
    else ok(`dsh pid ${run.pids.dsh}`)
  } else {
    fail('dsh not in run state')
  }

  // Jail wire in materialized profile
  const patch = path.join(paths().dshHome, 'profiles', 'web', 'cordis.patch.yml')
  if (!fs.existsSync(patch)) fail(`missing ${patch}`)
  else {
    const text = fs.readFileSync(patch, 'utf8')
    if (!text.includes('workspace-jail-fs')) fail('cordis.patch.yml missing workspace-jail-fs')
    else ok('jail wired in cordis.patch.yml')
    if (!text.includes('compaction-basic')) fail('missing compaction-basic')
    else ok('compaction-basic present')
  }

  // Memory seed
  const mem = paths(stack).memory
  if (!fs.existsSync(mem)) fail(`missing memory.json at ${mem}`)
  else {
    const j = JSON.parse(fs.readFileSync(mem, 'utf8'))
    if (j.version !== 1) fail('memory.json version != 1')
    else ok('memory.json seeded')
  }

  // HTTP
  const llamaUrl = run.urls.llama.replace(/\/$/, '')
  // Llama chat completion (proves model wired; Qwen3 may fill reasoning_content first)
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 90_000)
    const r = await fetch(`${llamaUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        model: 'coder',
        messages: [{ role: 'user', content: '/no_think\nReply with exactly: e2e-ok' }],
        max_tokens: 64,
        temperature: 0,
      }),
    })
    clearTimeout(t)
    const body = await r.json().catch(() => ({}))
    const msg = body?.choices?.[0]?.message || {}
    const text = String(msg.content || msg.reasoning_content || '').trim()
    if (r.ok && text) ok(`llama chat completion (${text.slice(0, 48).replace(/\s+/g, ' ')})`)
    else fail(`llama chat failed status=${r.status} content empty`)
  } catch (e) {
    fail(`llama chat error: ${e.message}`)
  }

  if (run.urls.dsh && (await httpOk(run.urls.dsh))) ok(`dsh HTTP ${run.urls.dsh}`)
  else fail(`dsh HTTP not reachable: ${run.urls?.dsh}`)

  // Guest
  if (!run.guestRunning && !run.guestName) {
    fail('guest not running')
  } else {
    const engine = detectContainerEngine()
    if (!engine.ok) fail(`engine: ${engine.detail}`)
    else {
      const name = run.guestName || `deep-guest-${stack}`
      const envCheck = spawnSync(
        engine.bin,
        ['exec', name, 'printenv', 'DEEP_NET_MODE'],
        { encoding: 'utf8', windowsHide: true, env: engineEnv(engine.bin) },
      )
      if (envCheck.status !== 0) {
        info('DEEP_NET_MODE unset — restart stack after alpha guest-env patch')
      } else {
        ok(`guest DEEP_NET_MODE=${String(envCheck.stdout).trim()}`)
      }

      const bash = spawnSync(
        engine.bin,
        ['exec', name, 'bash', '-lc', 'echo e2e-ok && test -d /workspace && pwd'],
        { encoding: 'utf8', windowsHide: true, env: engineEnv(engine.bin) },
      )
      if (bash.status !== 0 || !String(bash.stdout).includes('e2e-ok')) {
        fail(`guest bash failed: ${(bash.stderr || bash.stdout || '').slice(0, 120)}`)
      } else ok('guest bash + /workspace')
    }
  }

  console.log('')
  if (failures.length) {
    console.error(`[e2e] FAIL (${failures.length})`)
    for (const f of failures) console.error(`  • ${f}`)
    process.exit(1)
  }
  console.log('[e2e] PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
