import http from 'node:http'
import { buildIndex, searchIndex, indexStatus, defaultIndexDir } from './indexer.js'

/**
 * Localhost HTTP API for DSH code-search plugin.
 * POST /search { query, limit? }
 * POST /build {}
 * GET  /status
 * @param {{ port: number, workspaceRoot: string, llamaBase?: string }} opts
 */
export function startCodeIndexServer(opts) {
  const workspaceRoot = opts.workspaceRoot
  const indexDir = defaultIndexDir(workspaceRoot)
  const llamaBase = opts.llamaBase

  const server = http.createServer(async (req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    try {
      if (req.method === 'GET' && req.url === '/status') {
        return send(200, indexStatus(indexDir))
      }
      if (req.method === 'POST' && req.url === '/build') {
        const r = await buildIndex({ workspaceRoot, indexDir, llamaBase })
        return send(200, r)
      }
      if (req.method === 'POST' && req.url === '/search') {
        const body = await readBody(req)
        const j = JSON.parse(body || '{}')
        const r = await searchIndex({
          workspaceRoot,
          indexDir,
          query: j.query || '',
          llamaBase,
          limit: j.limit,
          localOnly: true,
        })
        return send(200, r)
      }
      if (req.method === 'POST' && req.url === '/touch') {
        const body = await readBody(req)
        const j = JSON.parse(body || '{}')
        const { indexFile } = await import('./indexer.js')
        await indexFile(workspaceRoot, j.path || '', llamaBase)
        return send(200, { ok: true, path: j.path })
      }
      send(404, { error: 'not found' })
    } catch (e) {
      send(500, { error: String(e.message || e) })
    }
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(opts.port, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : opts.port
      resolve({ server, port, url: `http://127.0.0.1:${port}` })
    })
  })
}

/** @param {import('node:http').IncomingMessage} req */
function readBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
