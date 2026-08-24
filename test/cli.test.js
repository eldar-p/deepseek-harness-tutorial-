import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { parseArgs, cmdHelp, cmdPresets, cmdDoctor, cmdStacks, cmdStop, cmdStatus, main } from '../src/cli.js'

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

test('cmdBootstrap missing gguf throws', async () => {
  const { cmdBootstrap } = await import('../src/cli.js')
  const missing = path.join(os.tmpdir(), `no-gguf-${process.pid}.gguf`)
  await assert.rejects(() => cmdBootstrap({ gguf: missing }), (e) => e.exitCode === 2)
})
