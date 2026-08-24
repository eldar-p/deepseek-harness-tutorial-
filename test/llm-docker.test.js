import test from 'node:test'
import assert from 'node:assert/strict'
import {
  llmContainerName,
  llmDockerSupportedPlatform,
  resolveLlmDockerBackend,
} from '../src/llm-docker.js'

test('llmContainerName', () => {
  assert.equal(llmContainerName('default', 'colibri'), 'gim-llm-colibri-default')
})

test('resolveLlmDockerBackend explicit flags', () => {
  assert.equal(resolveLlmDockerBackend({}, { vllm: true }), 'vllm')
  assert.equal(resolveLlmDockerBackend({}, { colibri: true }), 'colibri')
  assert.equal(resolveLlmDockerBackend({}, { 'llm-docker': 'vllm' }), 'vllm')
})

test('llmDockerSupportedPlatform excludes darwin', () => {
  const orig = process.platform
  try {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    assert.equal(llmDockerSupportedPlatform(), false)
  } finally {
    Object.defineProperty(process, 'platform', { value: orig })
  }
})
