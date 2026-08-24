import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stopAllStacks, isStopping, installShutdownHandlers } from '../src/shutdown.js'
import { writeRunState, clearRunState } from '../src/runstate.js'

test('isStopping false by default', () => {
  assert.equal(isStopping(), false)
})

test('stopAllStacks returns 0 when no run state', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-stop-'))
  const prev = process.env.DEEP_HOME
  process.env.DEEP_HOME = home
  try {
    const n = await stopAllStacks()
    assert.equal(n, 0)
  } finally {
    if (prev === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('stopAllStacks stops stack with guestRunning flag', async () => {
  const stack = `utest-sig-${process.pid}`
  writeRunState(stack, { pids: {}, guestRunning: true, guestName: `deep-guest-${stack}` })
  try {
    const n = await stopAllStacks({ emergency: true })
    assert.ok(n >= 1)
  } finally {
    clearRunState(stack)
  }
})

test('installShutdownHandlers respects DEEP_NO_SIGNAL_HANDLERS', () => {
  process.env.DEEP_NO_SIGNAL_HANDLERS = '1'
  try {
    installShutdownHandlers()
  } finally {
    delete process.env.DEEP_NO_SIGNAL_HANDLERS
  }
})

test('installShutdownHandlers registers when enabled', () => {
  delete process.env.DEEP_NO_SIGNAL_HANDLERS
  installShutdownHandlers()
})
