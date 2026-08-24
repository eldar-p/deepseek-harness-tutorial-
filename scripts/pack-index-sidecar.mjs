#!/usr/bin/env node
/**
 * Build gim-index sidecar binaries and print manifest pin snippet (sha256 + url).
 *
 * Usage:
 *   node scripts/pack-index-sidecar.mjs [--release-tag=v1.1.5] [--skip-build]
 *
 * Requires: rust/cargo on PATH for --skip-build=false (default tries build).
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sha256File } from '../src/download.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CRATE = path.join(ROOT, 'sidecar', 'gim-index')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const sidecarToml = fs.readFileSync(path.join(CRATE, 'Cargo.toml'), 'utf8')
const sidecarVer = sidecarToml.match(/^version = "([^"]+)"/m)?.[1] || '0.1.0'

const releaseTag =
  process.argv.find((a) => a.startsWith('--release-tag='))?.split('=')[1] ||
  process.env.GIM_INDEX_SIDECAR_TAG ||
  `v${pkg.version}`
const skipBuild = process.argv.includes('--skip-build')

function cargoBuild() {
  if (skipBuild) return true
  const r = spawnSync('cargo', ['build', '--release'], { cwd: CRATE, encoding: 'utf8', stdio: 'inherit' })
  return r.status === 0
}

function artifactFor(os, arch) {
  const exe = os === 'win32' ? 'gim-index.exe' : 'gim-index'
  const binPath = path.join(CRATE, 'target', 'release', exe)
  const cacheName = `gim-index-${os === 'win32' ? 'win' : os === 'darwin' ? 'darwin' : 'linux'}-${arch}${os === 'win32' ? '.exe' : ''}`
  return { os, arch, binPath, cacheName, binaryName: exe }
}

const targets = [
  artifactFor(process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux', process.arch === 'arm64' ? 'arm64' : 'x64'),
]

if (!cargoBuild()) {
  console.error('[FAIL] cargo build failed — install Rust or pass --skip-build after manual build')
  process.exit(1)
}

const releaseBase = `https://github.com/eldar-p/gim-cli/releases/download/${releaseTag}`
/** @type {object[]} */
const binaries = []

for (const t of targets) {
  if (!fs.existsSync(t.binPath)) {
    console.error(`[WARN] missing ${t.binPath}`)
    continue
  }
  const sha256 = sha256File(t.binPath)
  const url = `${releaseBase}/${t.cacheName}`
  binaries.push({
    os: t.os,
    arch: t.arch,
    url,
    sha256,
    cacheName: t.cacheName,
    binaryName: t.binaryName,
  })
  console.log(`[OK] ${t.cacheName} sha256=${sha256}`)
}

const snippet = {
  version: sidecarVer,
  releaseTag,
  releaseBase,
  note: 'Pin sha256 after uploading release assets; url=null keeps JS fallback until then.',
  binaries,
}

console.log('\n--- manifests/index-sidecar.json snippet (merge binaries + releaseTag) ---')
console.log(JSON.stringify(snippet, null, 2))
