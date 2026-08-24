import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  llmCacheId,
  universalColibriSpeedEnv,
  llmKeepWarm,
  dockerEnvArgs,
  ensureLlmCacheDirs,
  shouldRunAutoTune,
  markAutoTuneDone,
  autoTuneMarkerPath,
  assessSpeedHints,
  formatSpeedReport,
} from '../src/colibri-speed.js'
import {
  resolveLlmDockerBackend,
  llmContainerName,
} from '../src/llm-docker.js'

test('llmCacheId stable for same path', () => {
  const a = llmCacheId('E:\\models\\foo')
  const b = llmCacheId('E:\\models\\foo')
  assert.equal(a, b)
  assert.match(a, /^[a-f0-9]{16}$/)
})

test('universalColibriSpeedEnv has CUDA tier defaults', () => {
  const env = universalColibriSpeedEnv({ ramGb: 64 })
  assert.equal(env.COLI_CUDA, '1')
  assert.equal(env.CUDA_EXPERT_GB, 'auto')
  assert.equal(env.PIN_GB, 'all')
  assert.equal(env.RAM_GB, '64')
})

test('universalColibriSpeedEnv has KV slots and grammar', () => {
  const env = universalColibriSpeedEnv({ ramGb: 64 })
  assert.equal(env.COLI_KV_SLOTS, '8')
  assert.ok(env.GRAMMAR?.includes('gim-compact-json'))
})

test('dockerEnvArgs flattens env', () => {
  const args = dockerEnvArgs({ A: '1', B: '' })
  assert.deepEqual(args, ['-e', 'A=1'])
})

test('llmKeepWarm default on', () => {
  const prev = process.env.GIM_LLM_KEEP
  delete process.env.GIM_LLM_KEEP
  assert.equal(llmKeepWarm(), true)
  process.env.GIM_LLM_KEEP = '0'
  assert.equal(llmKeepWarm(), false)
  if (prev === undefined) delete process.env.GIM_LLM_KEEP
  else process.env.GIM_LLM_KEEP = prev
})

test('resolveLlmDockerBackend defaults to colibri on win/linux', () => {
  const orig = process.platform
  const prevDefault = process.env.GIM_DEFAULT_LLM
  delete process.env.GIM_DEFAULT_LLM
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    assert.equal(resolveLlmDockerBackend({}, {}), 'colibri')
    assert.equal(resolveLlmDockerBackend({}, { vllm: true }), 'vllm')
    assert.equal(resolveLlmDockerBackend({ gguf: 'x.gguf' }, {}), null)
  } finally {
    Object.defineProperty(process, 'platform', { value: orig })
    if (prevDefault === undefined) delete process.env.GIM_DEFAULT_LLM
    else process.env.GIM_DEFAULT_LLM = prevDefault
  }
})

test('llmContainerName', () => {
  assert.equal(llmContainerName('default', 'colibri'), 'gim-llm-colibri-default')
})

test('ensureLlmCacheDirs creates subdirs', () => {
  const model = path.join(os.tmpdir(), `gim-cache-${process.pid}`)
  const prev = process.env.GIM_HOME
  process.env.GIM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-home-'))
  const base = ensureLlmCacheDirs(model)
  assert.ok(fs.existsSync(path.join(base, 'xdg')))
  assert.ok(fs.existsSync(path.join(base, 'markers')))
  if (prev === undefined) delete process.env.GIM_HOME
  else process.env.GIM_HOME = prev
})

test('autoTune marker lifecycle', () => {
  const model = path.join(os.tmpdir(), `gim-tune-${process.pid}`)
  const prev = process.env.GIM_HOME
  process.env.GIM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-home2-'))
  assert.equal(shouldRunAutoTune(model), true)
  markAutoTuneDone(model)
  assert.equal(fs.existsSync(autoTuneMarkerPath(model)), true)
  assert.equal(shouldRunAutoTune(model), false)
  if (prev === undefined) delete process.env.GIM_HOME
  else process.env.GIM_HOME = prev
})

test('assessSpeedHints returns hints', () => {
  const r = assessSpeedHints()
  assert.ok(Array.isArray(r.hints))
  assert.ok(r.hints.length >= 3)
  assert.ok(['green', 'yellow', 'red'].includes(r.level))
  assert.match(formatSpeedReport(r), /GIM speed hints/)
})

test('universalColibriSpeedEnv respects COLI_KV_SLOTS', () => {
  const prev = process.env.COLI_KV_SLOTS
  process.env.COLI_KV_SLOTS = '4'
  assert.equal(universalColibriSpeedEnv({ ramGb: 32 }).COLI_KV_SLOTS, '4')
  if (prev === undefined) delete process.env.COLI_KV_SLOTS
  else process.env.COLI_KV_SLOTS = prev
})
