import test from 'node:test'
import assert from 'node:assert/strict'
import {
  llmCacheId,
  universalColibriSpeedEnv,
  llmKeepWarm,
  dockerEnvArgs,
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
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    assert.equal(resolveLlmDockerBackend({}, {}), 'colibri')
    assert.equal(resolveLlmDockerBackend({}, { vllm: true }), 'vllm')
    assert.equal(resolveLlmDockerBackend({ gguf: 'x.gguf' }, {}), null)
  } finally {
    Object.defineProperty(process, 'platform', { value: orig })
  }
})

test('llmContainerName', () => {
  assert.equal(llmContainerName('default', 'colibri'), 'gim-llm-colibri-default')
})
