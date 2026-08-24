import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { parseArgs, cmdHelp, cmdPresets, cmdDoctor, cmdStacks, cmdStop, cmdStatus, cmdBootstrap, main } from '../src/cli.js'

test('parseArgs command and flags', () => {
  const r = parseArgs(['start', '--cpu', '--name', 'dev', '--preset=balanced'])
  assert.equal(r.cmd, 'start')
  assert.equal(r.flags.cpu, true)
  assert.equal(r.flags.name, 'dev')
  assert.equal(r.flags.preset, 'balanced')
})

test('parseArgs equals form', () => {
  const r = parseArgs(['doctor', '--stage=rc', '--readiness'])
  assert.equal(r.cmd, 'doctor')
  assert.equal(r.flags.stage, 'rc')
  assert.equal(r.flags.readiness, true)
})

test('parseArgs default help', () => {
  assert.equal(parseArgs([]).cmd, 'help')
})

test('cmdHelp prints without throw', () => {
  cmdHelp()
})

test('cmdPresets lists presets', async () => {
  await cmdPresets()
})

test('cmdDoctor and readiness rc', async () => {
  await cmdDoctor({ readiness: true, stage: 'rc' })
})

test('cmdDoctor release gate', async () => {
  await cmdDoctor({ release: true })
})

test('cmdStacks lists', async () => {
  await cmdStacks()
})

test('cmdStatus --all', async () => {
  await cmdStatus({ all: true })
})

test('cmdStop with no run state', async () => {
  await cmdStop({ name: `__utest_stop_${process.pid}` })
})

test('main unknown command sets exitCode 2', async () => {
  const prev = process.exitCode
  process.exitCode = 0
  await main(['nope-cmd'])
  assert.equal(process.exitCode, 2)
  process.exitCode = prev
})

test('main help ok', async () => {
  await main(['help'])
})

test('cmdStatus default stack screen', async () => {
  await cmdStatus({})
})

test('cmdBootstrap seeds workspace', async () => {
  // Avoid long llama fetch in unit tests
  const prev = process.env.GIM_LLAMA_BIN
  process.env.GIM_LLAMA_BIN = path.join(os.tmpdir(), `no-llama-${process.pid}.exe`)
  try {
    await cmdBootstrap({ preset: 'dev', name: `utest-boot-${process.pid}` })
  } finally {
    if (prev === undefined) delete process.env.GIM_LLAMA_BIN
    else process.env.GIM_LLAMA_BIN = prev
  }
})

test('cmdStop cleans fake run state', async () => {
  const { writeRunState, clearRunState } = await import('../src/runstate.js')
  const stack = `utest-stop-${process.pid}`
  writeRunState(stack, {
    pids: { llama: 0, dsh: 0 },
    urls: {},
    guestRunning: false,
  })
  await cmdStop({ name: stack, 'wipe-session': true })
  clearRunState(stack)
})

test('main doctor ok', async () => {
  await main(['doctor'])
})

test('cmdHelp topic start', () => {
  process.env.GIM_NO_BANNER = '1'
  try {
    cmdHelp('start')
  } finally {
    delete process.env.GIM_NO_BANNER
  }
})

test('main version ok', async () => {
  process.env.GIM_NO_BANNER = '1'
  try {
    await main(['version'])
  } finally {
    delete process.env.GIM_NO_BANNER
  }
})

test('main check ok', async () => {
  process.env.GIM_NO_BANNER = '1'
  const prev = process.exitCode
  process.exitCode = 0
  try {
    await main(['check'])
  } finally {
    delete process.env.GIM_NO_BANNER
    process.exitCode = prev
  }
})

test('main deps ok', async () => {
  process.env.GIM_NO_BANNER = '1'
  const prev = process.exitCode
  process.exitCode = 0
  try {
    await main(['deps'])
  } finally {
    delete process.env.GIM_NO_BANNER
    process.exitCode = prev
  }
})

test('cmdBootstrap missing gguf throws', async () => {
  const missing = path.join(os.tmpdir(), `no-gguf-${process.pid}.gguf`)
  await assert.rejects(() => cmdBootstrap({ gguf: missing }), (e) => e.exitCode === 2)
})

test('cmdDoctor readiness 0.5', async () => {
  await cmdDoctor({ readiness: true, stage: '0.5' })
})
