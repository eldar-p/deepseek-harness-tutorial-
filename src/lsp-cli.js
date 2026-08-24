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
  if (sub === 'query' || sub === 'hover' || sub === 'definition' || sub === 'references' || sub === 'symbols' || sub === 'workspace_symbols') {
    const op =
      sub === 'query'
        ? flags.op || args[1] || 'hover'
        : sub === 'workspace_symbols'
          ? 'workspace_symbols'
          : sub
    const isWs = op === 'workspace_symbols'
    const fileArg = isWs
      ? flags.file || flags.path || null
      : sub === 'query'
        ? args[2] || flags.file || flags.path
        : args[1] || flags.file || flags.path
    const query = isWs
      ? String(flags.query || args[1] || '')
      : String(flags.query || '')
    if (!fileArg && !isWs) {
      throw Object.assign(
        new Error('Usage: gim lsp query <op> <file> [--line N] [--character N]'),
        { exitCode: 2 },
      )
    }
    const stack = flags.name || 'default'
    const ws = paths(stack).workspace
    const file = fileArg ? (path.isAbsolute(fileArg) ? fileArg : path.join(ws, fileArg)) : undefined
    if (file) {
      const server = pickServerForFile(file)
      if (!server.bin) {
        console.log(`[YELLOW] ${server.reason || 'no LSP server'}`)
      }
    }
    const r = await lspQuery({
      op,
      file,
      query,
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
  gim lsp servers
  gim lsp query <hover|definition|references|symbols|workspace_symbols> [file] [--line N] [--character N] [--name STACK]
  gim lsp workspace_symbols <query> [--name STACK]
  gim lsp hover <file> [--line N]
`)
  process.exitCode = 2
}
