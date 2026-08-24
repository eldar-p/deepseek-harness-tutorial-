import fs from 'node:fs'
import path from 'node:path'
import { paths, ensureDirs, PKG_ROOT } from './paths.js'

const BANNER_FILE = path.join(PKG_ROOT, 'assets', 'banner.txt')

/** Fallback if assets/banner.txt missing. */
const FALLBACK_ASCII = `
   ____ ___ __  __    ____ _     ___ 
  / ___|_ _|  \\/  |  / ___| |   |_ _|
 | |  _ | || |\\/| | | |   | |    | | 
 | |_| || || |  | | | |___| |___ | | 
  \\____|___|_|  |_|  \\____|_____|___|
`.trimStart()

function useColor() {
  if (process.env.NO_COLOR || process.env.GIM_NO_COLOR) return false
  return !!(process.stdout.isTTY && process.env.TERM !== 'dumb')
}

function paint(text, code) {
  if (!useColor()) return text
  return `\x1b[${code}m${text}\x1b[0m`
}

export function loadAsciiArt() {
  try {
    if (fs.existsSync(BANNER_FILE)) return fs.readFileSync(BANNER_FILE, 'utf8').replace(/\s+$/, '')
  } catch {
    /* */
  }
  return FALLBACK_ASCII.trimEnd()
}

export function readPkgVersion() {
  return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version
}

export function bannerEnabled() {
  if (process.env.GIM_NO_BANNER === '1') return false
  if (process.env.CI === 'true') return false
  return true
}

export function printBanner({ tagline = true } = {}) {
  if (!bannerEnabled()) return
  console.log(paint(loadAsciiArt(), '36'))
  if (tagline) {
    const ver = readPkgVersion()
    console.log(paint(`  GIM CLI  v${ver}  ·  llama.cpp + guest + GIM UI`, '2'))
    console.log('')
  }
}

export function welcomeMarkerPath() {
  return path.join(paths().home, '.welcomed')
}

export function isFirstRun() {
  try {
    return !fs.existsSync(welcomeMarkerPath())
  } catch {
    return true
  }
}

export function markWelcomed() {
  ensureDirs()
  const p = welcomeMarkerPath()
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, `${new Date().toISOString()}\n`, 'utf8')
  }
}

/** First-run greeting with ASCII art (once per GIM_HOME). */
export function maybePrintFirstRunWelcome() {
  if (!bannerEnabled() || !isFirstRun()) return false
  printBanner()
  console.log(paint('  Welcome — first run detected.', '1'))
  console.log('  Next:')
  console.log('    gim doctor')
  console.log('    gim bootstrap --gguf PATH\\to\\model.gguf')
  console.log('    gim start')
  console.log('    gim help')
  console.log('')
  markWelcomed()
  return true
}
