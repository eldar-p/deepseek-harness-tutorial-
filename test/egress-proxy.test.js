import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { startEgressProxy } from '../src/egress-proxy.js'

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => resolve(p))
    })
    s.on('error', reject)
  })
}

test('egress proxy rejects non-absolute URL', async () => {
  const port = await freePort()
  const { server } = await startEgressProxy({
    port,
    allowHosts: ['example.com'],
    bind: '127.0.0.1',
  })

  const status = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/relative`, (res) => resolve(res.statusCode)).on('error', () => resolve(0))
  })
  assert.equal(status, 400)
  await new Promise((r) => server.close(r))
})

test('guestProxyUrl uses docker.internal on win/mac', async () => {
  const { guestProxyUrl } = await import('../src/egress-proxy.js')
  const url = guestProxyUrl(18080)
  assert.match(url, /:18080/)
  assert.ok(url.startsWith('http://'))
})
