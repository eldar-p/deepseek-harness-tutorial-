import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths, ensureDirs, chmodOwnerOnly } from './paths.js'

const PRESET_NAMES = ['balanced', 'dev', 'offline', 'paranoia', 'open']

export function loadPreset(name) {
  const n = name || 'balanced'
  const local = path.join(PKG_ROOT, 'presets', `${n}.json`)
  if (!fs.existsSync(local)) {
    throw Object.assign(new Error(`Unknown preset: ${n}`), { exitCode: 2 })
  }
  return JSON.parse(fs.readFileSync(local, 'utf8'))
}

export function defaultConfig(overrides = {}) {
  const presetName = overrides.preset || 'balanced'
  const preset = loadPreset(presetName)
  return {
    version: 1,
    channel: 'stable',
    preset: presetName,
    guestNetwork: preset.guestNetwork,
    zeroTraces: preset.zeroTraces,
    telemetry: false,
    rebootRequired: false,
    defaultStack: 'default',
    gguf: null,
    stacks: {},
    ...overrides,
  }
}

export function readConfig() {
  const p = paths()
  if (!fs.existsSync(p.config)) return null
  return JSON.parse(fs.readFileSync(p.config, 'utf8'))
}

export function writeConfig(cfg) {
  const p = ensureDirs()
  fs.writeFileSync(p.config, JSON.stringify(cfg, null, 2), 'utf8')
  chmodOwnerOnly(p.config)
  return cfg
}

export function getOrInitConfig(opts = {}) {
  ensureDirs(opts.name || 'default')
  let cfg = readConfig()
  if (!cfg) {
    cfg = defaultConfig({
      preset: opts.preset,
      channel: opts.channel,
      gguf: opts.gguf || null,
    })
    // seed presets into ~/.deep/presets
    const src = path.join(PKG_ROOT, 'presets')
    for (const name of PRESET_NAMES) {
      const f = `${name}.json`
      fs.copyFileSync(path.join(src, f), path.join(paths().presets, f))
    }
    writeConfig(cfg)
  } else if (opts.preset) {
    const preset = loadPreset(opts.preset)
    cfg.preset = opts.preset
    cfg.guestNetwork = preset.guestNetwork
    cfg.zeroTraces = preset.zeroTraces
    writeConfig(cfg)
  }
  return cfg
}

export function applyPreset(cfg, presetName) {
  const preset = loadPreset(presetName)
  cfg.preset = presetName
  cfg.guestNetwork = preset.guestNetwork
  cfg.zeroTraces = preset.zeroTraces
  return writeConfig(cfg)
}

export function registerStack(cfg, name, meta = {}) {
  if (!name) return cfg
  cfg.stacks = cfg.stacks || {}
  cfg.stacks[name] = {
    ...(cfg.stacks[name] || {}),
    ...meta,
    updatedAt: new Date().toISOString(),
  }
  cfg.defaultStack = name
  return writeConfig(cfg)
}

export { PRESET_NAMES }
