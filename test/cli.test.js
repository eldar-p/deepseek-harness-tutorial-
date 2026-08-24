import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs, cmdHelp, cmdPresets, main } from '../src/cli.js'

test('parseArgs command and flags', () => {
  const r = parseArgs(['start', '--cpu', '--name', 'dev', '--preset=balanced'])
  assert.equal(r.cmd, 'start')
  assert.equal(r.flags.cpu, true)
  assert.equal(r.flags.name, 'dev')
  assert.equal(r.flags.preset, 'balanced')
})

test('parseArgs equals form', () => {
  const r = parseArgs(['doctor', '--stage=beta', '--readiness'])
  assert.equal(r.cmd, 'doctor')
  assert.equal(r.flags.stage, 'beta')
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
