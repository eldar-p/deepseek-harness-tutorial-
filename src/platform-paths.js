/**
 * Cross-platform default paths (Win / Linux / macOS) — no hardcoded drive letters.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { paths } from './paths.js'

export function defaultModelsDir() {
  return paths().models
}

export function defaultColibriRoot() {
  if (process.env.GIM_COLIBRI_ROOT) return process.env.GIM_COLIBRI_ROOT
  const home = paths().home
  const candidates = [
    path.join(home, 'runtime', 'colibri'),
    path.join(os.homedir(), '.colibri'),
    '/opt/colibri',
    '/usr/local/colibri',
  ]
  if (process.platform === 'darwin') {
    candidates.unshift(
      path.join(os.homedir(), 'Applications', 'Colibri'),
      '/Applications/Colibri',
    )
  }
  if (process.platform === 'win32') {
    for (const drive of ['E', 'D', 'C']) {
      candidates.unshift(`${drive}:\\colibri\\v1.7.0`, `${drive}:\\colibri`)
    }
  }
  for (const c of candidates) {
    if (!c) continue
    try {
      if (fs.existsSync(path.join(c, 'coli')) || fs.existsSync(path.join(c, 'deepseek_v4.exe'))) return c
      if (fs.existsSync(c)) {
        for (const ent of fs.readdirSync(c, { withFileTypes: true })) {
          if (!ent.isDirectory()) continue
          const nested = path.join(c, ent.name)
          if (fs.existsSync(path.join(nested, 'coli')) || fs.existsSync(path.join(nested, 'deepseek_v4.exe'))) {
            return nested
          }
        }
      }
    } catch {
      /* */
    }
  }
  return path.join(home, 'runtime', 'colibri')
}

export function defaultColibriModelDir(modelName = 'DeepSeek-V4-Flash-0731') {
  if (process.env.GIM_COLIBRI_MODEL) return process.env.GIM_COLIBRI_MODEL
  const candidates = [
    path.join(defaultModelsDir(), modelName),
    path.join(os.homedir(), 'models', modelName),
  ]
  if (process.platform === 'win32') {
    candidates.unshift(`E:\\models\\${modelName}`, `D:\\models\\${modelName}`)
  } else {
    candidates.unshift(`/models/${modelName}`, path.join('/opt', 'models', modelName))
  }
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'config.json'))) return c
  }
  return path.join(defaultModelsDir(), modelName)
}
