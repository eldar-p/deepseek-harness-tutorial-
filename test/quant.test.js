import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQuantFromPath, assessGgufQuant, formatQuantWarning, RECOMMENDED_MIN } from '../src/quant-warn.js'

test('parseQuantFromPath Q4_K_M', () => {
  assert.equal(parseQuantFromPath('E:/models/Llama-3-8B-Q4_K_M.gguf'), 'Q4_K_M')
})

test('parseQuantFromPath Q3', () => {
  assert.equal(parseQuantFromPath('Huihui-Qwen3-Coder-30B-abliterated.Q3_K_M.gguf'), 'Q3_K_M')
})

test('assessGgufQuant tiers', () => {
  assert.equal(assessGgufQuant('model-Q4_K_M.gguf').tier, 'recommended')
  assert.equal(assessGgufQuant('model-Q3_K_M.gguf').tier, 'degraded')
})

test('formatQuantWarning for Q4 is null', () => {
  assert.equal(formatQuantWarning(assessGgufQuant('x-Q4_K_M.gguf')), null)
})

test('formatQuantWarning for Q3 mentions recommended', () => {
  const w = formatQuantWarning(assessGgufQuant('x-Q3_K_M.gguf'))
  assert.ok(w.includes('Q3_K_M'))
  assert.ok(w.includes(RECOMMENDED_MIN))
})
