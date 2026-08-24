import fs from 'node:fs'

/** Strip UTF-8 BOM (PowerShell Set-Content / Notepad often add it). */
export function stripBom(text) {
  if (typeof text !== 'string') return text
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text.replace(/^\uFEFF/, '')
}

export function readJsonFile(file) {
  return JSON.parse(stripBom(fs.readFileSync(file, 'utf8')))
}

/** Write JSON as UTF-8 without BOM (Node default). */
export function writeJsonFile(file, value, space = 2) {
  const body = `${JSON.stringify(value, null, space)}\n`
  fs.writeFileSync(file, body, { encoding: 'utf8' })
}
