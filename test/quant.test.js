import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  parseQuantFromPath,
  assessGgufQuant,
  formatQuantWarning,
  quantStatusRow,
  enforceQuantPolicy,
  writeQuantHintFile,
  lowQuantAgentHints,
  RECOMMENDED_MIN,
} from '../src/quant-warn.js'
import { parseArgs } from '../src/cli.js'

test('parseQuantFromPath Q4_K_M', () => {
  assert.equal(parseQuantFromPath('E:/models/Llama-3-8B-Q4_K_M.gguf'), 'Q4_K_M')
})

test('parseQuantFromPath Q3', () => {
  assert.equal(parseQuantFromPath('Huihui-Qwen3-Coder-30B-abliterated.Q3_K_M.gguf'), 'Q3_K_M')
})

test('assessGgufQuant tiers', () => {
  assert.equal(assessGgufQuant('model-Q4_K_M.gguf').tier, 'recommended')
  assert.equal(assessGgufQuant('model-Q3_K_M.gguf').tier, 'degraded')
  assert.equal(assessGgufQuant('model-Q2_K.gguf').tier, 'severe')
})

test('formatQuantWarning for Q4 is null', () => {
  assert.equal(formatQuantWarning(assessGgufQuant('x-Q4_K_M.gguf')), null)
})

test('formatQuantWarning for Q3 is actionable', () => {
  const w = formatQuantWarning(assessGgufQuant('x-Q3_K_M.gguf'))
  assert.ok(w.includes('Q3_K_M'))
  assert.ok(w.includes(RECOMMENDED_MIN))
  assert.ok(w.includes('[HINT]'))
  assert.ok(w.includes('gim start --gguf'))
})

test('quantStatusRow Q3 yellow', () => {
  const r = quantStatusRow('model.Q3_K_M.gguf')
  assert.equal(r.level, 'yellow')
  assert.match(r.detail, /Q3_K_M/)
})

test('quantStatusRow Q4 green', () => {
  const r = quantStatusRow('model.Q4_K_M.gguf')
  assert.equal(r.level, 'green')
})

test('quantStatusRow api mode', () => {
  const r = quantStatusRow(null, { apiMode: true })
  assert.equal(r.level, 'green')
  assert.match(r.detail, /API/i)
})

test('enforceQuantPolicy allows Q3 by default', () => {
  assert.deepEqual(enforceQuantPolicy(assessGgufQuant('x-Q3_K_M.gguf'), {}), { ok: true })
})

test('enforceQuantPolicy blocks severe without force', () => {
  assert.throws(() => enforceQuantPolicy(assessGgufQuant('x-Q2_K.gguf'), {}), (e) => e.exitCode === 2)
})

test('enforceQuantPolicy force allows severe', () => {
  const r = enforceQuantPolicy(assessGgufQuant('x-Q2_K.gguf'), { 'force-quant': true })
  assert.equal(r.ok, true)
  assert.equal(r.forced, true)
})

test('enforceQuantPolicy require-q4 blocks Q3', () => {
  assert.throws(
    () => enforceQuantPolicy(assessGgufQuant('x-Q3_K_M.gguf'), { 'require-q4': true }),
    (e) => e.exitCode === 2,
  )
})

test('enforceQuantPolicy require-q4 allows Q4', () => {
  assert.deepEqual(enforceQuantPolicy(assessGgufQuant('x-Q4_K_M.gguf'), { 'require-q4': true }), {
    ok: true,
  })
})

test('writeQuantHintFile for Q3', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-qhint-'))
  try {
    const f = writeQuantHintFile(dir, assessGgufQuant('m.Q3_K_M.gguf'))
    assert.ok(f && fs.existsSync(f))
    assert.match(fs.readFileSync(f, 'utf8'), /tool budget/i)
    assert.ok(lowQuantAgentHints(assessGgufQuant('m.Q4_K_M.gguf')) === null)
    writeQuantHintFile(dir, assessGgufQuant('m.Q4_K_M.gguf'))
    assert.equal(fs.existsSync(path.join(dir, 'QUANT.md')), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('parseArgs force-quant and require-q4', () => {
  const r = parseArgs(['start', '--require-q4', '--force-quant', '--cpu'])
  assert.equal(r.flags['require-q4'], true)
  assert.equal(r.flags['force-quant'], true)
  assert.equal(r.flags.cpu, true)
})
