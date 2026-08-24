#!/usr/bin/env node
/**
 * Pack Deep CLI sources into dist/ for CDN / GitHub Release upload.
 * Prints sha256 + suggested cli-releases.json artifact snippet.
 *
 * Usage: node scripts/pack-release.mjs [--version=0.2.0-alpha]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const version = process.argv.find((a) => a.startsWith('--version='))?.split('=')[1] || pkg.version

const INCLUDE = [
  'bin',
  'src',
  'manifests',
  'assets',
  'presets',
  'dsh-plugins',
  'skills',
  'guest',
  'docs',
  'Dockerfile.guest',
  'LICENSE',
  'CHANGELOG.md',
  'README.md',
  'ALPHA.md',
  'PRE-ALPHA.md',
  'RELEASE-1.1.md',
  'package.json',
]

const outDir = path.join(ROOT, 'dist')
fs.mkdirSync(outDir, { recursive: true })
const base = `deep-cli-${version}`
const staging = path.join(outDir, base)
fs.rmSync(staging, { recursive: true, force: true })
fs.mkdirSync(staging, { recursive: true })

function copyRecursive(src, dst) {
  const st = fs.statSync(src)
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    for (const name of fs.readdirSync(src)) {
      if (name === 'node_modules' || name === '.git' || name === '.coverage') continue
      copyRecursive(path.join(src, name), path.join(dst, name))
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
}

for (const rel of INCLUDE) {
  const src = path.join(ROOT, rel)
  if (!fs.existsSync(src)) {
    console.warn(`[WARN] skip missing ${rel}`)
    continue
  }
  copyRecursive(src, path.join(staging, rel))
}

const zipName = `${base}.zip`
const zipPath = path.join(outDir, zipName)
fs.rmSync(zipPath, { force: true })

let packed = false
if (process.platform === 'win32') {
  const ps = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipPath}' -Force`],
    { encoding: 'utf8' },
  )
  packed = ps.status === 0 && fs.existsSync(zipPath)
  if (!packed) console.error(ps.stderr || ps.stdout)
} else {
  const tar = spawnSync('zip', ['-r', zipPath, base], { cwd: outDir, encoding: 'utf8' })
  packed = tar.status === 0
}

if (!packed) {
  console.error('[FAIL] could not create zip — install zip or use PowerShell Compress-Archive')
  process.exit(1)
}

const buf = fs.readFileSync(zipPath)
const sha = createHash('sha256').update(buf).digest('hex')
const sizeKiB = Math.round(buf.length / 1024)
const side = `${zipPath}.sha256`
fs.writeFileSync(side, `${sha}  ${zipName}\n`, 'utf8')

console.log(`[OK] ${zipPath} (${sizeKiB} KiB)`)
console.log(`sha256: ${sha}`)
console.log(`[OK] sidecar ${side}`)
console.log('')
console.log('Suggested manifests/cli-releases.json artifact (fill url after upload):')
console.log(
  JSON.stringify(
    {
      os: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
      arch: process.arch === 'arm64' ? 'arm64' : 'x64',
      format: 'zip',
      url: `https://github.com/eldar-p/deepseek-harness-tutorial-/releases/download/v${version}/${zipName}`,
      sha256: sha,
      sha256Url: `https://github.com/eldar-p/deepseek-harness-tutorial-/releases/download/v${version}/${zipName}.sha256`,
    },
    null,
    2,
  ),
)
console.log('')
console.log('License of packaged sources: CC-BY-NC-SA-4.0 (see LICENSE inside archive)')
