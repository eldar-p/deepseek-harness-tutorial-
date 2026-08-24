/**
 * Colibri LLM backend — OpenAI-compatible `coli serve` for safetensors models.
 */
import fs from 'node:fs'
import path from 'node:path'
import { paths, appendLog } from './paths.js'
import { defaultColibriRoot, defaultColibriModelDir } from './platform-paths.js'
import { resolveContextWindow } from './context-policy.js'
import { spawnDetached, waitHttpOk, runLogPath, isPidAlive, stopService } from './proc.js'
import { which } from './detect.js'

export const DEFAULT_COLIBRI_MODEL_ID = 'deepseek-v4-flash'

export function resolveColibriRoot() {
  return defaultColibriRoot()
}

export function resolveColiLauncher(root = resolveColibriRoot()) {
  if (!root) return null
  const coli = path.join(root, 'coli')
  if (fs.existsSync(coli)) return coli
  return null
}

export function resolveColibriModelPath(cfg = {}) {
  const p =
    process.env.GIM_COLIBRI_MODEL ||
    cfg.colibriModel ||
    cfg.colibri?.modelPath ||
    defaultColibriModelDir()
  return path.resolve(String(p))
}

export function resolveColibriCtx(cfg = {}, flags = {}) {
  return resolveContextWindow(cfg, flags)
}

export function colibriModelReady(modelPath) {
  if (!fs.existsSync(modelPath)) return { ok: false, detail: `missing model dir: ${modelPath}`, shards: 0 }
  const hasConfig = fs.existsSync(path.join(modelPath, 'config.json'))
  let shards = 0
  let shardNames = []
  try {
    shardNames = fs.readdirSync(modelPath).filter((f) => f.endsWith('.safetensors'))
    shards = shardNames.length
  } catch {
    /* */
  }
  if (!hasConfig) return { ok: false, detail: 'config.json missing', shards }

  const indexPath = path.join(modelPath, 'model.safetensors.index.json')
  let expected = null
  if (fs.existsSync(indexPath)) {
    try {
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
      expected = new Set(Object.values(idx.weight_map || {})).size
    } catch {
      /* */
    }
  }

  // DeepSeek-V4-Flash-0731 ships 48 shards; allow override via env for smaller test models
  const minShards = Number(process.env.GIM_COLIBRI_MIN_SHARDS || (expected || 40))
  if (shards < 1) {
    return { ok: false, detail: 'no .safetensors shards yet (download in progress?)', shards, expected }
  }
  if (expected && shards < expected) {
    return {
      ok: false,
      detail: `download incomplete: ${shards}/${expected} shards`,
      shards,
      expected,
    }
  }
  if (!expected && shards < minShards) {
    return {
      ok: false,
      detail: `download incomplete: ${shards} shards (need ≥${minShards} or wait for index)`,
      shards,
      expected: minShards,
    }
  }
  return { ok: true, shards, expected: expected || minShards, detail: `${shards} shards` }
}

export function resolvePython() {
  if (process.env.GIM_PYTHON && fs.existsSync(process.env.GIM_PYTHON)) return process.env.GIM_PYTHON
  return which('py') || which('python') || which('python3')
}

/**
 * @returns {Promise<{ ok: boolean, pid?: number, port?: number, url?: string, modelId?: string, modelPath?: string, warming?: boolean, detail?: string }>}
 */
export async function startColibri({
  stack = 'default',
  port,
  modelPath,
  modelId = process.env.GIM_COLIBRI_MODEL_ID || DEFAULT_COLIBRI_MODEL_ID,
  ramGb = Number(process.env.GIM_COLIBRI_RAM || 48),
  ctx,
  cfg = {},
} = {}) {
  const contextTokens = ctx ?? resolveColibriCtx(cfg, {})
  const root = resolveColibriRoot()
  const coli = resolveColiLauncher(root)
  if (!coli) {
    return {
      ok: false,
      detail: 'Colibri not found — set GIM_COLIBRI_ROOT or install under ~/.gim/runtime/colibri',
    }
  }
  const model = modelPath || resolveColibriModelPath(cfg)
  const ready = colibriModelReady(model)
  if (!ready.ok) return { ok: false, detail: ready.detail }

  const py = resolvePython()
  if (!py) return { ok: false, detail: 'Python not on PATH (coli launcher needs it)' }

  const logFile = runLogPath(stack, 'colibri')
  const env = {
    COLI_MODEL: model,
    COLI_API_KEY: process.env.GIM_COLIBRI_API_KEY || 'sk-gim-colibri',
    GIM_COLIBRI_MODEL: model,
  }

  /** @type {string[]} */
  let binArgs
  /** @type {string} */
  let bin
  if (process.platform === 'win32') {
    bin = py
    binArgs = py.toLowerCase().endsWith('py.exe') || path.basename(py).toLowerCase() === 'py'
      ? ['-3', coli, 'serve', '--model', model, '--host', '127.0.0.1', '--port', String(port), '--model-id', modelId]
      : [coli, 'serve', '--model', model, '--host', '127.0.0.1', '--port', String(port), '--model-id', modelId]
    if (ramGb > 0) binArgs.push('--ram', String(ramGb))
    if (contextTokens > 0) binArgs.push('--ctx', String(contextTokens))
  } else {
    bin = coli
    binArgs = ['serve', '--model', model, '--host', '127.0.0.1', '--port', String(port), '--model-id', modelId]
    if (ramGb > 0) binArgs.push('--ram', String(ramGb))
    if (contextTokens > 0) binArgs.push('--ctx', String(contextTokens))
  }

  const pid = spawnDetached(bin, binArgs, {
    cwd: root,
    env,
    logFile,
  })

  const url = `http://127.0.0.1:${port}/v1`
  const apiKey = env.COLI_API_KEY || 'sk-gim-colibri'
  try {
    await waitHttpOk(`${url}/models`, {
      timeoutMs: 300_000,
      intervalMs: 3000,
      label: 'colibri',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch (e) {
    if (pid && isPidAlive(pid)) {
      appendLog(`event=colibri_warming stack=${stack} port=${port}`)
      return {
        ok: true,
        warming: true,
        pid,
        port,
        url,
        modelId,
        modelPath: model,
        detail: `warming pid=${pid}: ${e.message}`,
      }
    }
    return { ok: false, detail: `Colibri not ready: ${e.message}`, pid }
  }

  appendLog(`event=colibri_start stack=${stack} port=${port} model=${model} ctx=${contextTokens}`)
  return { ok: true, pid, port, url, modelId, modelPath: model, ctx: contextTokens }
}

export function stopColibri(pid, { port = null } = {}) {
  stopService({ pid, port, force: true })
  appendLog(`event=colibri_stop pid=${pid} port=${port ?? ''}`)
}

export function colibriStatus(cfg = {}) {
  const root = resolveColibriRoot()
  const model = resolveColibriModelPath(cfg)
  return {
    root,
    coli: resolveColiLauncher(root),
    modelPath: model,
    modelReady: colibriModelReady(model),
    modelId: process.env.GIM_COLIBRI_MODEL_ID || DEFAULT_COLIBRI_MODEL_ID,
  }
}

/** Detect whether start flags/config request Colibri backend. */
export function isColibriMode(cfg, flags = {}) {
  if (flags.colibri === true || flags.colibri === '') return true
  if (flags.llm === 'colibri' || flags.backend === 'colibri') return true
  if (process.env.GIM_LLM === 'colibri' || process.env.GIM_BACKEND === 'colibri') return true
  if (cfg?.llm === 'colibri' || cfg?.backend === 'colibri') return true
  return false
}
