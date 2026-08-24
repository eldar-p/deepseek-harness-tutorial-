/**
 * Universal Colibri speed policy — env knobs only, no per-model names in GIM.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { paths } from './paths.js'
import { detectGpu, detectContainerEngine } from './detect.js'
import { hostSummary } from './detect.js'
import { LOW_RAM_CTX_CAP, LOW_RAM_THRESHOLD_GB } from './context-policy.js'
import { readConfig } from './config.js'
import { resolveLlmDockerBackend } from './llm-docker.js'
import { colibriNativeEngineReady, resolveColibriModelPath } from './colibri.js'
import { isApiMode } from './api-provider.js'

/** Stable cache id from resolved model directory (content-agnostic). */
export function llmCacheId(modelPath) {
  const resolved = path.resolve(String(modelPath || 'default'))
  return crypto.createHash('sha256').update(resolved).digest('hex').slice(0, 16)
}

export function llmPersistentCacheDir(modelPath) {
  return path.join(paths().home, 'cache', 'llm', llmCacheId(modelPath))
}

export function ensureLlmCacheDirs(modelPath) {
  const base = llmPersistentCacheDir(modelPath)
  for (const sub of ['xdg', 'mirror', 'markers']) {
    fs.mkdirSync(path.join(base, sub), { recursive: true })
  }
  return base
}

export function autoTuneMarkerPath(modelPath) {
  return path.join(llmPersistentCacheDir(modelPath), 'markers', 'coli-tune.done')
}

export function shouldRunAutoTune(modelPath) {
  if (process.env.GIM_COLIBRI_AUTO_TUNE === '0') return false
  if (process.env.GIM_COLIBRI_AUTO_TUNE === '1') return true
  return !fs.existsSync(autoTuneMarkerPath(modelPath))
}

export function markAutoTuneDone(modelPath) {
  const f = autoTuneMarkerPath(modelPath)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, `${new Date().toISOString()}\n`, 'utf8')
}

/**
 * Universal Colibri runtime env for Docker (override via host env).
 * @param {{ ramGb?: number, ctx?: number }} opts
 */
export function universalColibriSpeedEnv(opts = {}) {
  const ramGb = opts.ramGb ?? Number(process.env.GIM_COLIBRI_RAM || 48)
  const kvSlots = Number(process.env.COLI_KV_SLOTS || process.env.GIM_KV_SLOTS || 8)
  const env = {
    COLI_CUDA: process.env.COLI_CUDA ?? '1',
    COLI_CUDA_PIPE: process.env.COLI_CUDA_PIPE ?? '2',
    COLI_CUDA_TC_W4A16: process.env.COLI_CUDA_TC_W4A16 ?? '1',
    COLI_CUDA_ATTN: process.env.COLI_CUDA_ATTN ?? '1',
    CUDA_EXPERT_GB: process.env.CUDA_EXPERT_GB ?? 'auto',
    PIN_GB: process.env.PIN_GB ?? 'all',
    RAM_GB: process.env.RAM_GB ?? String(ramGb),
    PIN: process.env.PIN ?? 'auto',
    PIPE: process.env.PIPE ?? '1',
    URING: process.env.URING ?? '1',
    DIRECT: process.env.DIRECT ?? '0',
    KVSAVE: process.env.KVSAVE ?? '1',
    REPIN: process.env.REPIN ?? '256',
    CAP_RAISE: process.env.CAP_RAISE ?? '1',
    AUTOPIN: process.env.AUTOPIN ?? '1',
    COLI_KV_SLOTS: String(Math.min(Math.max(kvSlots, 2), 16)),
    COLI_MAX_QUEUE: process.env.COLI_MAX_QUEUE ?? '8',
    COLI_QUEUE_TIMEOUT: process.env.COLI_QUEUE_TIMEOUT ?? '300',
    CACHE_ROUTE: process.env.CACHE_ROUTE ?? '0',
  }
  if (process.env.COLI_GPUS) env.COLI_GPUS = process.env.COLI_GPUS
  if (process.env.CUDA_DENSE === '1') env.CUDA_DENSE = '1'
  if (process.env.GIM_GRAMMAR_TOOLS !== '0') {
    env.GRAMMAR = process.env.GRAMMAR || '/grammars/gim-compact-json.gbnf'
    env.GRAMMAR_DRAFT = process.env.GRAMMAR_DRAFT || '24'
    env.COLI_TEMP = process.env.COLI_TEMP ?? '0'
  }
  if (process.env.GIM_COLIBRI_AUTO_TIER === '1' || process.env.COLI_AUTO_TIER === '1') {
    env.COLI_AUTO_TIER = '1'
  }
  return env
}

/** Flatten env object to docker -e args pairs. */
export function dockerEnvArgs(env) {
  /** @type {string[]} */
  const out = []
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined || v === null || v === '') continue
    out.push('-e', `${k}=${v}`)
  }
  return out
}

export function llmKeepWarm() {
  return process.env.GIM_LLM_KEEP !== '0'
}

/**
 * @param {object} opts
 * @returns {{ hints: string[], level: 'green'|'yellow'|'red' }}
 */
export function assessSpeedHints(opts = {}) {
  const host = hostSummary()
  const gpu = detectGpu()
  const engine = detectContainerEngine()
  /** @type {string[]} */
  const hints = []
  let level = 'green'

  if (host.totalmemGb < 48) {
    hints.push('RAM < 48 GB — raise --ram only within free memory; expect disk expert misses')
    level = 'yellow'
  }
  if (host.totalmemGb < LOW_RAM_THRESHOLD_GB && !process.env.GIM_CTX) {
    hints.push(
      `RAM < ${LOW_RAM_THRESHOLD_GB} GB — runtime ctx capped at ${LOW_RAM_CTX_CAP} (set GIM_CTX to override)`,
    )
    if (level === 'green') level = 'yellow'
  }
  if (!engine.ok) {
    hints.push('Docker not running — Colibri default stack needs Docker')
    level = 'red'
  } else {
    try {
      const cfg = readConfig()
      if (!isApiMode(cfg) && resolveLlmDockerBackend(cfg, {}) === 'colibri') {
        const eng = colibriNativeEngineReady(undefined, resolveColibriModelPath(), { docker: true })
        if (!eng.ok) {
          hints.push(`Colibri Linux ELF engine missing — ${eng.detail}`)
          level = 'red'
        }
      }
    } catch {
      /* no config */
    }
    if (gpu.discrete) {
      const probe = process.env.GIM_DOCKER_GPU_OK
      if (probe === '0') {
        hints.push('Install NVIDIA Container Toolkit for GPU tier (COLI_CUDA=1)')
        level = 'yellow'
      }
    } else {
      hints.push('No discrete GPU — Colibri CPU tier; use cloud --api for speed if needed')
      level = 'yellow'
    }
  }

  hints.push('Keep model on fast NVMe (not network drive) — expert streaming is disk-bound')
  hints.push('gim stop keeps LLM warm; gim stop --full-stop removes container')
  hints.push('Override: GIM_CTX for runtime ctx; 512K meter ≠ safe RAM for MoE')
  if (process.platform === 'linux') {
    hints.push('Linux: URING=1 PIPE=1 (defaults); DIRECT=1 optional on local NVMe (+65% on some hosts)')
  }
  hints.push('Per-chat KV: cache_slot from chatId (COLI_KV_SLOTS default 8)')
  if (process.env.GIM_GRAMMAR_TOOLS !== '0') {
    hints.push('Grammar drafts on (GIM_GRAMMAR_TOOLS) — agent temp 0 for structural tokens')
  }
  if (process.env.GIM_COLIBRI_AUTO_TUNE !== '0') {
    hints.push('First start may run coli tune — one-time per machine+model path')
  }
  hints.push('Measure reclaimable speed: gim doctor --ki · gim index bench')
  return { hints, level }
}

export function formatSpeedReport(report) {
  const lines = ['GIM speed hints']
  for (const h of report.hints) lines.push(`  ${report.level === 'red' ? '!' : '·'} ${h}`)
  return lines.join('\n')
}
