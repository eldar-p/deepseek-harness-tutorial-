import test from 'node:test'
import assert from 'node:assert/strict'
import { isStopping, installShutdownHandlers } from '../src/shutdown.js'

test('installShutdownHandlers is callable', () => {
  process.env.DEEP_NO_SIGNAL_HANDLERS = '1'
  installShutdownHandlers()
  assert.equal(isStopping(), false)
  delete process.env.DEEP_NO_SIGNAL_HANDLERS
})
