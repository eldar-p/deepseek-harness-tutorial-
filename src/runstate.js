import fs from 'node:fs'
import path from 'node:path'
import { paths, chmodOwnerOnly } from './paths.js'
import { readJsonFile, writeJsonFile } from './json-io.js'

export function readRunState(stack = 'default') {
  const f = path.join(paths(stack).run, 'state.json')
  if (!fs.existsSync(f)) return null
  try {
    return readJsonFile(f)
  } catch {
    return null
  }
}

export function writeRunState(stack, state) {
  const dir = paths(stack).run
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, 'state.json')
  writeJsonFile(f, state)
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

export function stackIsActive(stack) {
  const run = readRunState(stack)
  if (!run) return false
  return !!(run.pids?.llama || run.pids?.dsh || run.guestRunning)
}

/** @returns {{ name: string, active: boolean, llama: boolean, dsh: boolean, guest: boolean, urls: object|null }[]} */
export function summarizeStacks() {
  const names = new Set(listStacks())
  try {
    const cfg = readJsonFile(paths().config)
    for (const n of Object.keys(cfg.stacks || {})) names.add(n)
  } catch {
    /* no config */
  }
  if (names.size === 0) names.add('default')

  return [...names].sort().map((name) => {
    const run = readRunState(name)
    return {
      name,
      active: stackIsActive(name),
      llama: !!(run?.pids?.llama),
      dsh: !!(run?.pids?.dsh),
      guest: run?.guestRunning === true,
      urls: run?.urls || null,
    }
  })
}
