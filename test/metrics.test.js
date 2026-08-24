import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  recordMetric,
  readMetrics,
  summarizeAgentMetrics,
  formatMetricsSummary,
  metricsEnabled,
} from '../src/metrics.js'
import { embedMode, hashEmbed, clearEmbedProbeCacheForTests } from '../src/code-index/embedder.js'

test('recordMetric and summarize', () => {
  const prev = process.env.GIM_HOME
  const prevM = process.env.GIM_METRICS
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-met-'))
  process.env.GIM_HOME = home
  delete process.env.GIM_METRICS
  try {
    assert.equal(metricsEnabled(), true)
    recordMetric('agent', { stack: 'default', durationMs: 100, toolCalls: 2, rounds: 1, ok: true })
    recordMetric('agent', { stack: 'default', durationMs: 200, toolCalls: 4, rounds: 2, ok: true })
    const rows = readMetrics('agent', { limit: 10 })
    assert.equal(rows.length, 2)
    const s = summarizeAgentMetrics()
    assert.equal(s.n, 2)
    assert.equal(s.meanRoundMs, 150)
    assert.match(formatMetricsSummary(s), /mean=150ms/)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    if (prevM === undefined) delete process.env.GIM_METRICS
    else process.env.GIM_METRICS = prevM
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('embedMode respects env', () => {
  const prev = process.env.GIM_INDEX_EMBED
  process.env.GIM_INDEX_EMBED = 'hash'
  assert.equal(embedMode(), 'hash')
  process.env.GIM_INDEX_EMBED = 'llama'
  assert.equal(embedMode(), 'llama')
  if (prev === undefined) delete process.env.GIM_INDEX_EMBED
  else process.env.GIM_INDEX_EMBED = prev
  clearEmbedProbeCacheForTests()
})

test('hashEmbed stable', () => {
  assert.deepEqual(Array.from(hashEmbed('a')), Array.from(hashEmbed('a')))
})
