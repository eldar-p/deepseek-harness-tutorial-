import fs from 'node:fs'
import {
  buildMcpClientConfig,
  formatMcpConfigHelp,
  loadMcpServersConfig,
  saveMcpServersConfig,
  mcpServersConfigPath,
} from './mcp-config.js'
import {
  doctorMcpServers,
  listAllMcpTools,
  listAllMcpResources,
  listAllMcpPrompts,
  callMcpServerTool,
  loadEnabledMcpServers,
} from './mcp-client.js'

/**
 * @param {object} flags
 * @param {string[]} args
 */
export async function cmdMcp(flags, args) {
  const sub = (args[0] || '').toLowerCase()

  if (sub === 'config') {
    console.log(formatMcpConfigHelp())
    return
  }

  if (sub === 'client' || sub === 'servers') {
    return cmdMcpClient(flags, args.slice(1))
  }

  if (sub === 'doctor') {
    const rows = await doctorMcpServers()
    if (!rows.length) {
      console.log(`No MCP servers in ${mcpServersConfigPath()}`)
      console.log('Add: gim mcp client add NAME --command node --args \'["path/to/server.mjs"]\'')
      return
    }
    for (const r of rows) {
      console.log(`${r.ok ? '[OK]' : '[FAIL]'} ${r.name}: ${r.detail}`)
    }
    return
  }

  if (sub === 'tools') {
    const rows = await listAllMcpTools()
    for (const r of rows) {
      console.log(`\n## ${r.server}`)
      if (r.error) {
        console.log(`  ERROR: ${r.error}`)
        continue
      }
      for (const t of r.tools) {
        console.log(`  - ${t.name}: ${(t.description || '').slice(0, 120)}`)
      }
    }
    return
  }

  if (sub === 'resources') {
    const server = args[1]
    let rows = await listAllMcpResources()
    if (server) rows = rows.filter((r) => r.server === server)
    if (server && !rows.length) {
      console.log(`Unknown MCP server: ${server}`)
      process.exitCode = 1
      return
    }
    for (const r of rows) {
      console.log(`\n## ${r.server}`)
      if (r.error) {
        console.log(`  ERROR: ${r.error}`)
        continue
      }
      for (const res of r.resources || []) {
        console.log(`  - ${res.uri}: ${res.name || ''} ${(res.description || '').slice(0, 80)}`.trim())
      }
    }
    return
  }

  if (sub === 'prompts') {
    const server = args[1]
    let rows = await listAllMcpPrompts()
    if (server) rows = rows.filter((r) => r.server === server)
    if (server && !rows.length) {
      console.log(`Unknown MCP server: ${server}`)
      process.exitCode = 1
      return
    }
    for (const r of rows) {
      console.log(`\n## ${r.server}`)
      if (r.error) {
        console.log(`  ERROR: ${r.error}`)
        continue
      }
      for (const p of r.prompts || []) {
        console.log(`  - ${p.name}: ${(p.description || '').slice(0, 120)}`)
      }
    }
    return
  }

  if (sub === 'watch') {
    const server = args[1]
    const uri = args[2]
    if (!server || !uri) {
      throw Object.assign(new Error('Usage: gim mcp watch SERVER URI [--timeout MS]'), { exitCode: 2 })
    }
    const { watchMcpResource } = await import('./mcp-client.js')
    const timeoutMs = flags.timeout ? Number(flags.timeout) : 30_000
    const r = await watchMcpResource(server, uri, { timeoutMs })
    console.log(JSON.stringify(r, null, 2))
    return
  }

  if (sub === 'call') {
    const server = args[1]
    const tool = args[2]
    if (!server || !tool) {
      throw Object.assign(new Error('Usage: gim mcp call SERVER TOOL [--json \'{"key":"val"}\']'), {
        exitCode: 2,
      })
    }
    let toolArgs = {}
    if (flags.json) {
      try {
        toolArgs = JSON.parse(String(flags.json))
      } catch {
        throw Object.assign(new Error('--json must be valid JSON'), { exitCode: 2 })
      }
    }
    const r = await callMcpServerTool(server, tool, toolArgs)
    if (!r.ok) {
      console.error(`[ERR] ${r.error}`)
      process.exitCode = 1
      return
    }
    console.log(r.text)
    return
  }

  // Default: start GIM MCP server (stdio)
  return 'spawn'
}

/**
 * @param {object} flags
 * @param {string[]} args
 */
async function cmdMcpClient(flags, args) {
  const sub = (args[0] || 'list').toLowerCase()
  const cfgPath = mcpServersConfigPath()

  if (sub === 'list') {
    const cfg = loadMcpServersConfig()
    const names = Object.keys(cfg.mcpServers || {})
    console.log(`MCP servers (${cfgPath}):`)
    if (!names.length) {
      console.log('  (none)')
      console.log('\nExample:')
      console.log('  gim mcp client add github --command npx --args \'["-y","@modelcontextprotocol/server-github"]\'')
      return
    }
    for (const n of names) {
      const s = cfg.mcpServers[n]
      const tag = s.disabled ? 'OFF' : 'ON '
      console.log(`  [${tag}] ${n}: ${s.command} ${(s.args || []).join(' ')}`)
    }
    return
  }

  if (sub === 'add') {
    const name = args[1]
    if (!name) {
      throw Object.assign(new Error('Usage: gim mcp client add NAME --command CMD [--args JSON] [--env JSON]'), {
        exitCode: 2,
      })
    }
    const command = flags.command || flags.cmd
    if (!command) {
      throw Object.assign(new Error('--command required'), { exitCode: 2 })
    }
    /** @type {string[]} */
    let mcpArgs = []
    if (flags.args) {
      try {
        mcpArgs = JSON.parse(String(flags.args))
        if (!Array.isArray(mcpArgs)) throw new Error('not array')
      } catch {
        throw Object.assign(new Error('--args must be JSON array, e.g. \'["script.mjs"]\''), { exitCode: 2 })
      }
    }
    /** @type {Record<string, string>} */
    let env = {}
    if (flags.env) {
      try {
        env = JSON.parse(String(flags.env))
      } catch {
        throw Object.assign(new Error('--env must be JSON object'), { exitCode: 2 })
      }
    }
    const cfg = loadMcpServersConfig()
    cfg.mcpServers[name] = { command: String(command), args: mcpArgs, env }
    saveMcpServersConfig(cfg)
    console.log(`[OK] Added MCP server "${name}" → ${cfgPath}`)
    return
  }

  if (sub === 'remove' || sub === 'rm') {
    const name = args[1]
    if (!name) {
      throw Object.assign(new Error('Usage: gim mcp client remove NAME'), { exitCode: 2 })
    }
    const cfg = loadMcpServersConfig()
    if (!cfg.mcpServers[name]) {
      throw Object.assign(new Error(`unknown server: ${name}`), { exitCode: 2 })
    }
    delete cfg.mcpServers[name]
    saveMcpServersConfig(cfg)
    console.log(`[OK] Removed "${name}"`)
    return
  }

  if (sub === 'import') {
    const from = args[1] || flags.from
    if (!from || !fs.existsSync(from)) {
      throw Object.assign(new Error('Usage: gim mcp client import PATH.json'), { exitCode: 2 })
    }
    const external = JSON.parse(fs.readFileSync(from, 'utf8'))
    const cfg = loadMcpServersConfig()
    cfg.mcpServers = { ...cfg.mcpServers, ...(external.mcpServers || external) }
    saveMcpServersConfig(cfg)
    console.log(`[OK] Imported into ${cfgPath}`)
    return
  }

  if (sub === 'example') {
    const cfg = buildMcpClientConfig()
    saveMcpServersConfig({ mcpServers: cfg.mcpServers })
    console.log(`[OK] Wrote GIM-as-server example to ${cfgPath}`)
    return
  }

  console.log(`Usage:
  gim mcp client list
  gim mcp client add NAME --command CMD [--args '["a","b"]'] [--env '{"K":"V"}']
  gim mcp client remove NAME
  gim mcp client import PATH.json
  gim mcp client example
  gim mcp doctor
  gim mcp tools
  gim mcp call SERVER TOOL [--json '{}']
  gim mcp config
`)
  process.exitCode = 2
}
