import fs from 'node:fs'
import path from 'node:path'
import { paths, ensureDirs, PKG_ROOT } from './paths.js'

const BANNER_FILE = path.join(PKG_ROOT, 'assets', 'banner.txt')

/** Fallback if assets/banner.txt missing. */
const FALLBACK_ASCII = `
 ____                               ____     __     ______     
/\\  _\`\\                            /\\  _\`\\  /\\ \\   /\\__  _\\    
\\ \\ \\/\\ \\     __     __   _____    \\ \\ \\/\\_\\\\ \\ \\  \\/_/\\ \\/    
 \\ \\ \\ \\ \\  /'__\`\\ /'__\`\\/\\ '__\`\\   \\ \\ \\/_/_\\ \\ \\  __\\ \\ \\    
  \\ \\ \\_\\ \\/\\  __//\\  __/\\ \\ \\L\\ \\   \\ \\ \\L\\ \\\\ \\ \\L\\ \\\\_\\ \\__ 
   \\ \\____/\\ \\____\\ \\____\\\\ \\ ,__/    \\ \\____/ \\ \\____//\\_____\\
    \\/___/  \\/____/\\/____/ \\ \\ \\/      \\/___/   \\/___/ \\/_____/
                            \\ \\_\\                              
                             \\/_/
`.trimStart()

function useColor() {
  if (process.env.NO_COLOR || process.env.DEEP_NO_COLOR) return false
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
  if (process.env.DEEP_NO_BANNER === '1') return false
  if (process.env.CI === 'true') return false
  return true
}

export function printBanner({ tagline = true } = {}) {
  if (!bannerEnabled()) return
  console.log(paint(loadAsciiArt(), '36'))
  if (tagline) {
    const ver = readPkgVersion()
    console.log(paint(`  Deep CLI  v${ver}  ·  llama.cpp + guest + DSH`, '2'))
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

/** First-run greeting with ASCII art (once per DEEP_HOME). */
export function maybePrintFirstRunWelcome() {
  if (!bannerEnabled() || !isFirstRun()) return false
  printBanner()
  console.log(paint('  Welcome — first run detected.', '1'))
  console.log('  Next:')
  console.log('    deep doctor')
  console.log('    deep bootstrap --gguf PATH\\to\\model.gguf')
  console.log('    deep start')
  console.log('    deep help')
  console.log('')
  markWelcomed()
  return true
}
