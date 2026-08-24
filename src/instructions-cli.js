import fs from 'node:fs'
import {
  initAiInstructions,
  refreshAiInstructions,
  syncAiInstructions,
  aiInstructionsPath,
  readAiInstructionsMeta,
} from './instructions.js'

/**
 * @param {object} flags
 * @param {string[]} args
 */
export async function cmdInstructions(flags, args) {
  const sub = (args[0] || 'show').toLowerCase()
  const stack = flags.name || 'default'

  if (sub === 'init') {
    const r = initAiInstructions(stack, { force: flags.force === true })
    if (r.created) console.log(`[OK] Created ${r.path} (${r.source})`)
    else console.log(`[INFO] Already exists: ${r.path} (use --force to overwrite)`)
    return
  }

  if (sub === 'refresh') {
    const r = refreshAiInstructions(stack)
    console.log(`[OK] Refreshed ${r.path}`)
    console.log(`  scripts=${r.scriptCount} ci=${r.ciCount} mcp=${r.mcpCount}`)
    return
  }

  if (sub === 'sync') {
    const r = syncAiInstructions(stack, { writeAgents: flags['write-agents'] === true })
    console.log(`[OK] Synced ${r.path}`)
    if (r.agentsWritten) console.log(`[OK] Wrote ${r.agentsPath}`)
    else if (fs.existsSync(r.agentsPath)) console.log(`[INFO] AGENTS.md kept (use --write-agents to overwrite)`)
    return
  }

  if (sub === 'show' || sub === 'cat') {
    const meta = readAiInstructionsMeta(stack)
    if (!meta.exists) {
      console.log(`[WARN] No instructions — run: gim instructions init --name ${stack}`)
      process.exitCode = 1
      return
    }
    console.log(fs.readFileSync(meta.path, 'utf8'))
    return
  }

  console.log(`Usage:
  gim instructions init [--name STACK] [--force]
  gim instructions refresh [--name STACK]
  gim instructions sync [--name STACK] [--write-agents]
  gim instructions show [--name STACK]
`)
  process.exitCode = 2
}

export { aiInstructionsPath }
