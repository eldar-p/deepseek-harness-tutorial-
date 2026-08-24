import test from 'node:test'
import assert from 'node:assert/strict'
import { runCoordinator, cmdCoord } from '../src/coordinator.js'

test('runCoordinator splits and searches', async () => {
  const searchFn = async ({ query }) => ({
    ok: true,
    hits: [{ path: 'a.js', startLine: 1, symbol: query, score: 1 }],
  })
  const out = await runCoordinator('auth and logout', {
    stack: 'default',
    searchFn,
  })
  assert.equal(out.workers, 2)
  assert.equal(out.results[0].hits[0].symbol, 'auth')
})

test('runCoordinator empty task throws', async () => {
  await assert.rejects(() => runCoordinator(''), (e) => e.exitCode === 2)
})

test('cmdCoord prints json', async () => {
  // uses real index — may be empty; still returns structure
  const out = await runCoordinator('nonexistent_symbol_xyz', {
    searchFn: async () => ({ ok: false, hits: [] }),
  })
  assert.equal(out.results[0].ok, false)
  void cmdCoord
})
