import net from 'node:net'

/** Pick a free TCP port on 127.0.0.1 (non-system range). */
export function findFreePort(min = 1024, max = 65535) {
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const port = min + Math.floor(Math.random() * Math.min(20000, max - min))
      const srv = net.createServer()
      srv.unref()
      srv.on('error', () => tryOnce())
      srv.listen(port, '127.0.0.1', () => {
        const p = srv.address().port
        srv.close(() => resolve(p))
      })
    }
    tryOnce()
  })
}

export async function allocateStackPorts() {
  const llamaPort = await findFreePort(18000, 19000)
  const dshPort = await findFreePort(13000, 14000)
  return { llamaPort, dshPort }
}
