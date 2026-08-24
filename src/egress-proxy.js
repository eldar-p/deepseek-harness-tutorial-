import http from 'node:http'
import net from 'node:net'
import tls from 'node:tls'
import { URL } from 'node:url'
import { readSecrets, secretHeadersForHost } from './secrets.js'

/**
 * Host-side egress proxy (agent-sandbox pattern).
 * Guest sees HTTP_PROXY only — secrets stay on host.
 *
 * @param {{ port: number, allowHosts: string[], bind?: string, log?: (msg: string) => void }} opts
 */
export function startEgressProxy(opts) {
  const allow = buildAllowSet(opts.allowHosts)
  const secrets = readSecrets()
  const log = opts.log || (() => {})
  const bind = opts.bind || '127.0.0.1'

  const server = http.createServer((req, res) => {
    handleHttp(req, res, allow, secrets, log).catch((e) => {
      res.writeHead(502)
      res.end(String(e.message || e))
    })
  })

  server.on('connect', (req, clientSocket, head) => {
    handleConnect(req, clientSocket, head, allow, secrets, log)
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(opts.port, bind, () => {
      resolve({ server, port: opts.port, url: `http://${bind}:${opts.port}` })
    })
  })
}

/** @param {string[]} domains */
function buildAllowSet(domains) {
  const set = new Set()
  for (const d of domains) {
    const x = String(d || '').trim().toLowerCase()
    if (!x || x === '*') return new Set(['*'])
    set.add(x)
  }
  return set
}

/** @param {string} host @param {Set<string>} allow */
function hostAllowed(host, allow) {
  if (allow.has('*')) return true
  const h = String(host || '').toLowerCase().split(':')[0]
  if (allow.has(h)) return true
  for (const d of allow) {
    if (h === d || h.endsWith(`.${d}`)) return true
  }
  return false
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Set<string>} allow
 * @param {Record<string, Record<string, string>>} secrets
 * @param {(msg: string) => void} log
 */
async function handleHttp(req, res, allow, secrets, log) {
  const target = req.url?.startsWith('http') ? new URL(req.url) : null
  if (!target) {
    res.writeHead(400)
    res.end('absolute URL required')
    return
  }
  if (!hostAllowed(target.hostname, allow)) {
    log(`DENY http ${target.hostname}`)
    res.writeHead(403)
    res.end('host not in allowlist')
    return
  }
  const inject = secretHeadersForHost(target.hostname, secrets)
  const headers = { ...req.headers, ...inject, host: target.host }
  delete headers['proxy-connection']
  const mod = target.protocol === 'https:' ? await import('node:https') : http
  const upstream = mod.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('error', (e) => {
    res.writeHead(502)
    res.end(String(e.message))
  })
  req.pipe(upstream)
}

/**
 * @param {http.IncomingMessage} req
 * @param {import('node:net').Socket} clientSocket
 * @param {Buffer} head
 */
function handleConnect(req, clientSocket, head, allow, secrets, log) {
  const [host, portStr] = String(req.url || '').split(':')
  const port = Number(portStr) || 443
  if (!hostAllowed(host, allow)) {
    log(`DENY connect ${host}:${port}`)
    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    clientSocket.destroy()
    return
  }
  const inject = secretHeadersForHost(host, secrets)
  const socket = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length) socket.write(head)
    if (Object.keys(inject).length) {
      log(`ALLOW connect ${host}:${port} (+secrets)`)
    } else {
      log(`ALLOW connect ${host}:${port}`)
    }
    socket.pipe(clientSocket)
    clientSocket.pipe(socket)
  })
  socket.on('error', () => {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    clientSocket.destroy()
  })
}

/** Resolve proxy URL reachable from guest container. */
export function guestProxyUrl(port) {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return `http://host.docker.internal:${port}`
  }
  // Linux: host gateway
  return `http://172.17.0.1:${port}`
}
