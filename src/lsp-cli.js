import path from 'node:path'
import { paths } from './paths.js'
import { listAvailableServers, lspQuery, pickServerForFile } from './lsp-bridge.js'

/**
 * @param {object} flags
 * @param {string[]} args
 */
export async function cmdLsp(flags, args) {
  const sub = args[0]
  if (sub === 'servers' || sub === 'list') {
    const rows = listAvailableServers()
    console.log('Host language servers:')
    for (const s of rows) {
      const tag = s.ok ? 'OK  ' : 'MISS'
      console.log(`  ${tag}  ${s.id.padEnd(16)} ${s.bin || '—'}  (${s.exts.join(', ')})`)
    }
    console.log('\nInstall tip: npm i -g typescript-language-server typescript')
    return
  }
  if (sub === 'query' || sub === 'hover' || sub === 'definition' || sub === 'references' || sub === 'symbols') {
    const op = sub === 'query' ? flags.op || args[1] || 'hover' : sub
    const fileArg = sub === 'query' ? args[2] || flags.file || flags.path : args[1] || flags.file || flags.path
    if (!fileArg) {
      throw Object.assign(
        new Error('Usage: deep lsp query <op> <file> [--line N] [--character N]'),
        { exitCode: 2 },
      )
    }
    const stack = flags.name || 'default'
    const ws = paths(stack).workspace
    const file = path.isAbsolute(fileArg) ? fileArg : path.join(ws, fileArg)
    const server = pickServerForFile(file)
    if (!server.bin) {
      console.log(`[YELLOW] ${server.reason || 'no LSP server'}`)
    }
    const r = await lspQuery({
      op,
      file,
      line: Number(flags.line || 0),
      character: Number(flags.character || flags.col || 0),
      workspace: ws,
    })
    if (!r.ok) {
      console.error(`[ERR] ${r.error}`)
      process.exitCode = 1
      return
    }
    console.log(JSON.stringify({ server: r.server, op: r.op, result: r.result }, null, 2))
    return
  }

  console.log(`Usage:
  deep lsp servers
  deep lsp query <hover|definition|references|symbols> <file> [--line N] [--character N] [--name STACK]
  deep lsp hover <file> [--line N]
`)
  process.exitCode = 2
}
