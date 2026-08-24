import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { daemonTick, writeDaemonState, readDaemonState, cmdDaemon } from '../src/daemon.js'
import { writeRunState, clearRunState } from '../src/runstate.js'

test('daemonTick probes urls from runstate', async () => {
  const prevHome = process.env.DEEP_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-daemon-'))
  process.env.DEEP_HOME = home
  try {
    writeRunState('default', {
      urls: { llama: 'http://127.0.0.1:9', dsh: 'http://127.0.0.1:9' },
    })
    const fetchFn = async (url) => {
      if (String(url).includes('/health')) return { ok: true, status: 200 }
      return { ok: true, status: 200 }
    }
    const summary = await daemonTick('default', { fetchFn, timeoutMs: 500, proactive: false })
    assert.equal(summary.ok, true)
    assert.equal(summary.checks.length, 2)
  } finally {
    if (prevHome === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prevHome
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('writeProactiveNudge on unhealthy', async () => {
  const prevHome = process.env.DEEP_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-proactive-'))
  process.env.DEEP_HOME = home
  try {
    const { writeProactiveNudge, proactivePath } = await import('../src/daemon.js')
    const f = writeProactiveNudge({
      at: 't',
      stack: 'default',
      ok: false,
      checks: [{ name: 'llama', ok: false, detail: 'down' }],
    })
    assert.ok(f)
    assert.ok(fs.existsSync(proactivePath('default')))
    assert.match(fs.readFileSync(proactivePath('default'), 'utf8'), /UNHEALTHY/)
  } finally {
    if (prevHome === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prevHome
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('daemon status when stopped', async () => {
  const prevHome = process.env.DEEP_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-daemon-st-'))
  process.env.DEEP_HOME = home
  try {
    clearRunState('default')
    writeDaemonState('default', { pid: null })
    assert.equal(readDaemonState('default').pid, null)
    await cmdDaemon({ name: 'default' }, ['status'])
  } finally {
    if (prevHome === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prevHome
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('cmdDaemon usage without known sub sets exit 2', async () => {
  const prev = process.exitCode
  process.exitCode = 0
  await cmdDaemon({}, ['wat'])
  assert.equal(process.exitCode, 2)
  process.exitCode = prev
})
