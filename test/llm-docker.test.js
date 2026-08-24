import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detectContainerEngine } from '../src/detect.js'
import {
  llmContainerName,
  llmDockerSupportedPlatform,
  resolveLlmDockerBackend,
  assertLlmDockerPlatform,
  resolveLlmDockerModelPath,
  isLlmDockerRunning,
  getDockerPublishedPort,
} from '../src/llm-docker.js'

test('llmContainerName', () => {
  assert.equal(llmContainerName('default', 'colibri'), 'gim-llm-colibri-default')
  assert.equal(llmContainerName('dev', 'vllm'), 'gim-llm-vllm-dev')
})

test('resolveLlmDockerBackend explicit flags', () => {
  assert.equal(resolveLlmDockerBackend({}, { vllm: true }), 'vllm')
  assert.equal(resolveLlmDockerBackend({}, { colibri: true }), 'colibri')
  assert.equal(resolveLlmDockerBackend({}, { 'llm-docker': 'vllm' }), 'vllm')
  assert.equal(resolveLlmDockerBackend({ defaultLlm: 'api' }, {}), null)
})

test('resolveLlmDockerBackend env GIM_DEFAULT_LLM', () => {
  const prev = process.env.GIM_DEFAULT_LLM
  process.env.GIM_DEFAULT_LLM = 'gguf'
  assert.equal(resolveLlmDockerBackend({}, {}), null)
  process.env.GIM_DEFAULT_LLM = 'colibri'
  const orig = process.platform
  try {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    assert.equal(resolveLlmDockerBackend({}, {}), 'colibri')
  } finally {
    Object.defineProperty(process, 'platform', { value: orig })
    if (prev === undefined) delete process.env.GIM_DEFAULT_LLM
    else process.env.GIM_DEFAULT_LLM = prev
  }
})

test('llmDockerSupportedPlatform excludes darwin', () => {
  const orig = process.platform
  try {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    assert.equal(llmDockerSupportedPlatform(), false)
    assert.throws(() => assertLlmDockerPlatform(), /macOS/)
  } finally {
    Object.defineProperty(process, 'platform', { value: orig })
  }
})

test('llmDockerSupportedPlatform win/linux', () => {
  const orig = process.platform
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    assert.equal(llmDockerSupportedPlatform(), true)
    assert.doesNotThrow(() => assertLlmDockerPlatform())
  } finally {
    Object.defineProperty(process, 'platform', { value: orig })
  }
})

test('resolveLlmDockerModelPath env', () => {
  const model = path.join(os.tmpdir(), `gim-llm-model-${process.pid}`)
  const prev = process.env.GIM_LLM_MODEL
  process.env.GIM_LLM_MODEL = model
  assert.equal(resolveLlmDockerModelPath('colibri', {}), path.resolve(model))
  if (prev === undefined) delete process.env.GIM_LLM_MODEL
  else process.env.GIM_LLM_MODEL = prev
})

test('isLlmDockerRunning boolean', () => {
  assert.equal(typeof isLlmDockerRunning('__no_stack__'), 'boolean')
})

test('resolveLlmDockerBackend null when --gguf explicit', () => {
  assert.equal(resolveLlmDockerBackend({ llm: 'colibri' }, { gguf: 'x.gguf' }), null)
})

test('resolveLlmDockerBackend --colibri wins over cfg.gguf', () => {
  assert.equal(
    resolveLlmDockerBackend({ gguf: 'F:/models/qwen.gguf', llm: 'colibri' }, { colibri: true }),
    'colibri',
  )
})

test('resolveLlmDockerBackend defaults to colibri on win/linux', () => {
  const origPlatform = process.platform
  const prevDefault = process.env.GIM_DEFAULT_LLM
  delete process.env.GIM_DEFAULT_LLM
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    assert.equal(resolveLlmDockerBackend({}, {}), 'colibri')
    assert.equal(resolveLlmDockerBackend({ gguf: 'x.gguf' }, {}), null)
    assert.equal(resolveLlmDockerBackend({ gguf: 'x.gguf', llm: 'colibri' }, {}), 'colibri')
  } finally {
    Object.defineProperty(process, 'platform', { value: origPlatform })
    if (prevDefault === undefined) delete process.env.GIM_DEFAULT_LLM
    else process.env.GIM_DEFAULT_LLM = prevDefault
  }
})

test('getDockerPublishedPort null without container', () => {
  const engine = detectContainerEngine()
  if (!engine.ok) {
    assert.equal(getDockerPublishedPort('docker', 'gim-llm-colibri-nope'), null)
    return
  }
  assert.equal(getDockerPublishedPort(engine.bin, 'gim-llm-colibri-nope'), null)
})
