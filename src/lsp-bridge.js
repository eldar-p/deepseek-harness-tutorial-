/**
 * Host-side LSP helper (no npm deps).
 * Detects language servers and runs best-effort queries when installed.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { which } from './detect.js'

const SERVERS = [
  { id: 'typescript', bins: ['typescript-language-server'], args: ['--stdio'], exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] },
  { id: 'pyright', bins: ['pyright-langserver'], args: ['--stdio'], exts: ['.py'] },
  { id: 'gopls', bins: ['gopls'], args: [], exts: ['.go'] },
  { id: 'rust-analyzer', bins: ['rust-analyzer'], args: [], exts: ['.rs'] },
]

/**
 * @param {string} filePath
 */
export function pickServerForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  for (const s of SERVERS) {
    if (!s.exts.includes(ext)) continue
    for (const bin of s.bins) {
      const found = which(bin)
      if (found) return { ...s, bin: found }
    }
    return { ...s, bin: null, reason: `${s.bins[0]} not on PATH` }
  }
  return { id: null, bin: null, reason: `no LSP mapping for ${ext || 'unknown'}` }
}

/** List which language servers are currently available. */
export function listAvailableServers() {
  return SERVERS.map((s) => {
    let bin = null
    for (const b of s.bins) {
      bin = which(b)
      if (bin) break
    }
    return { id: s.id, bin, exts: s.exts, ok: !!bin }
  })
}

/**
 * Best-effort one-shot LSP request via stdio JSON-RPC.
 * @param {{ op: string, file: string, line?: number, character?: number, workspace?: string, timeoutMs?: number }} opts
 */
export async function lspQuery(opts) {
  const file = path.resolve(opts.file)
  if (!fs.existsSync(file)) {
    return { ok: false, error: `file not found: ${file}` }
  }
  const server = pickServerForFile(file)
  if (!server.bin) {
    return { ok: false, error: server.reason || 'language server not installed', server: server.id }
  }

  const workspace = path.resolve(opts.workspace || path.dirname(file))
  const line = Math.max(0, Number(opts.line || 0))
  const character = Math.max(0, Number(opts.character || 0))
  const op = String(opts.op || 'hover')
  const timeoutMs = opts.timeoutMs || 8_000

  const method =
    op === 'definition'
      ? 'textDocument/definition'
      : op === 'references'
        ? 'textDocument/references'
        : op === 'symbols'
          ? 'textDocument/documentSymbol'
          : 'textDocument/hover'

  const uri = pathToFileUrl(file)
  const text = fs.readFileSync(file, 'utf8')

  return await new Promise((resolve) => {
    const child = spawn(server.bin, server.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let buf = Buffer.alloc(0)
    let settled = false
    const done = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {
        /* */
      }
      resolve(result)
    }
    const timer = setTimeout(() => done({ ok: false, error: 'lsp timeout', server: server.id }), timeoutMs)

    const send = (msg) => {
      const body = Buffer.from(JSON.stringify(msg), 'utf8')
      child.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8'), body]))
    }

    child.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (true) {
        const headerEnd = buf.indexOf('\r\n\r\n')
        if (headerEnd < 0) break
        const header = buf.slice(0, headerEnd).toString('utf8')
        const m = header.match(/Content-Length:\s*(\d+)/i)
        if (!m) {
          buf = buf.slice(headerEnd + 4)
          continue
        }
        const len = Number(m[1])
        const start = headerEnd + 4
        if (buf.length < start + len) break
        const raw = buf.slice(start, start + len).toString('utf8')
        buf = buf.slice(start + len)
        let msg
        try {
          msg = JSON.parse(raw)
        } catch {
          continue
        }
        if (msg.id === 1) {
          send({ jsonrpc: '2.0', method: 'initialized', params: {} })
          send({
            jsonrpc: '2.0',
            method: 'textDocument/didOpen',
            params: {
              textDocument: { uri, languageId: guessLang(file), version: 1, text },
            },
          })
          const params =
            method === 'textDocument/documentSymbol'
              ? { textDocument: { uri } }
              : {
                  textDocument: { uri },
                  position: { line, character },
                  ...(method === 'textDocument/references'
                    ? { context: { includeDeclaration: true } }
                    : {}),
                }
          send({ jsonrpc: '2.0', id: 2, method, params })
        }
        if (msg.id === 2) {
          done({ ok: true, server: server.id, op, result: msg.result ?? null, error: msg.error || null })
        }
      }
    })

    child.on('error', (e) => done({ ok: false, error: e.message, server: server.id }))

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootUri: pathToFileUrl(workspace),
        capabilities: {},
        workspaceFolders: [{ uri: pathToFileUrl(workspace), name: path.basename(workspace) }],
      },
    })
  })
}

function guessLang(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.py') return 'python'
  if (ext === '.go') return 'go'
  if (ext === '.rs') return 'rust'
  if (ext === '.ts' || ext === '.tsx') return 'typescript'
  return 'javascript'
}

function pathToFileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(abs)) return `file:///${abs}`
  return `file://${abs.startsWith('/') ? '' : '/'}${abs}`
}
