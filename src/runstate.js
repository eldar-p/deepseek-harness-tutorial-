import fs from 'node:fs'
import path from 'node:path'
import { paths, chmodOwnerOnly } from './paths.js'

export function readRunState(stack = 'default') {
  const f = path.join(paths(stack).run, 'state.json')
  if (!fs.existsSync(f)) return null
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

export function writeRunState(stack, state) {
  const dir = paths(stack).run
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, 'state.json')
  fs.writeFileSync(f, JSON.stringify(state, null, 2), 'utf8')
  chmodOwnerOnly(f)
  return state
}

export function clearRunState(stack = 'default') {
  const f = path.join(paths(stack).run, 'state.json')
  if (fs.existsSync(f)) fs.unlinkSync(f)
}

export function listStacks() {
  const runRoot = path.join(paths().home, 'run')
  if (!fs.existsSync(runRoot)) return []
  return fs
    .readdirSync(runRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
}
