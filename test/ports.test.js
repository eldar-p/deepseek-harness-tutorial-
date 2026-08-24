import test from 'node:test'
import assert from 'node:assert/strict'
import { findFreePort, allocateStackPorts } from '../src/ports.js'

test('findFreePort returns usable port on 127.0.0.1', async () => {
  const port = await findFreePort(20000, 20100)
  assert.ok(port >= 20000 && port <= 20100)
})

test('allocateStackPorts returns distinct ranges', async () => {
  const { llamaPort, dshPort } = await allocateStackPorts()
  assert.ok(llamaPort >= 18000 && llamaPort <= 19000)
  assert.ok(dshPort >= 13000 && dshPort <= 14000)
  assert.notEqual(llamaPort, dshPort)
})
