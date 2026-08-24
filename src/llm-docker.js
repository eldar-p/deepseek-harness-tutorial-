/**
 * LLM in Docker — Colibri default (universal); optional --vllm.
 * See docs/PRINCIPLES.md and docs/SPEED.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { detectContainerEngine, detectGpu, engineEnv } from './detect.js'
import { PKG_ROOT, appendLog } from './paths.js'
import { loadManifest } from './download.js'
import { toContainerHostPath } from './guest.js'
import { waitHttpOk } from './proc.js'
import { isColibriMode, resolveColibriModelPath, resolveColibriRoot, colibriModelReady } from './colibri.js'
import { isVllmMode, isApiMode } from './api-provider.js'
import { resolveContextWindow } from './context-policy.js'
import {
  ensureLlmCacheDirs,
  universalColibriSpeedEnv,
  dockerEnvArgs,
  llmCacheId,
  llmKeepWarm,
  shouldRunAutoTune,
  markAutoTuneDone,
} from './colibri-speed.js'

export function llmDockerSupportedPlatform() {
  return process.platform === 'win32' || process.platform === 'linux'
}

export function assertLlmDockerPlatform() {
  if (!llmDockerSupportedPlatform()) {
    throw Object.assign(
      new Error(
        'LLM Docker (Colibri) needs Win/Linux + Docker — on macOS use `gim start --gguf` or `--api`.',
      ),
      { exitCode: 2 },
    )
  }
}

function defaultColibriDocker(cfg = {}, flags = {}) {
  if (flags.gguf || cfg.gguf) return false
  if (isApiMode(cfg, flags)) return false
  const d = (process.env.GIM_DEFAULT_LLM || cfg.defaultLlm || 'colibri').toLowerCase()
  if (d === 'none' || d === 'gguf' || d === 'api') return false
  return llmDockerSupportedPlatform()
}

/** @returns {'colibri'|'vllm'|null} */
export function resolveLlmDockerBackend(cfg = {}, flags = {}) {
  if (flags.gguf || cfg.gguf) return null
  const explicit = (flags['llm-docker'] || process.env.GIM_LLM_DOCKER || '').toLowerCase().trim()
  if (explicit === 'vllm') return 'vllm'
  if (explicit === 'colibri') return 'colibri'
  if (isVllmMode(cfg, flags)) return 'vllm'
  if (isColibriMode(cfg, flags)) return 'colibri'
  if (cfg?.llm === 'vllm' || cfg?.backend === 'vllm') return 'vllm'
  if (cfg?.llm === 'colibri' || cfg?.backend === 'colibri') return 'colibri'
  if (defaultColibriDocker(cfg, flags)) return 'colibri'
  return null
}

export function llmContainerName(stack, backend = 'colibri') {
  return `gim-llm-${backend}-${stack}`
}

function llmManifest(backend) {
  const man = loadManifest('llm-docker.json')
  return man[backend] || null
}

function dockerGpuArgs(engineBin) {
  const probe = spawnSync(
    engineBin,
    ['run', '--rm', '--gpus', 'all', 'alpine', 'true'],
    { encoding: 'utf8', windowsHide: true, env: engineEnv(engineBin) },
  )
  if (probe.status === 0) {
    process.env.GIM_DOCKER_GPU_OK = '1'
    return ['--gpus', 'all']
  }
  process.env.GIM_DOCKER_GPU_OK = '0'
  if (detectGpu().discrete) {
    console.log('[YELLOW] GPU present but Docker --gpus failed — install NVIDIA Container Toolkit')
  } else {
    console.log('[YELLOW] No GPU in Docker — CPU expert tier (slow)')
  }
  return []
}

export async function ensureLlmDockerImage(backend) {
  const engine = detectContainerEngine()
  if (!engine.ok || !engine.bin) {
    return { ok: false, reason: engine.detail || 'Docker/Podman not running' }
  }
  const spec = llmManifest(backend)
  if (!spec) return { ok: false, reason: `unknown llm-docker backend: ${backend}` }

  const image = spec.image
  const inspect = spawnSync(engine.bin, ['image', 'inspect', image], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engine.bin),
  })
  if (inspect.status === 0) return { ok: true, image, engine, spec }

  if (backend === 'vllm' && spec.pull) {
    console.log(`[INFO] Pulling ${image}…`)
    const pull = spawnSync(engine.bin, ['pull', image], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
      env: engineEnv(engine.bin),
    })
    if (pull.status !== 0) {
      return { ok: false, reason: (pull.stderr || pull.stdout || 'pull failed').slice(0, 240) }
    }
    appendLog(`event=llm_docker_pull backend=${backend} image=${image}`)
    return { ok: true, image, engine, spec }
  }

  const dockerfileRel = spec.dockerfile || 'docker/Dockerfile.colibri'
  const dockerfile = path.join(PKG_ROOT, dockerfileRel)
  if (!fs.existsSync(dockerfile)) {
    return { ok: false, reason: `image ${image} missing and no ${dockerfileRel}` }
  }
  console.log(`[INFO] Building LLM image ${image}…`)
  const build = spawnSync(engine.bin, ['build', '-t', image, '-f', dockerfile, PKG_ROOT], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...engineEnv(engine.bin), DOCKER_BUILDKIT: process.env.DOCKER_BUILDKIT || '1' },
  })
  if (build.status !== 0) {
    return { ok: false, reason: (build.stderr || build.stdout || 'build failed').slice(0, 240) }
  }
  appendLog(`event=llm_docker_build backend=${backend} image=${image}`)
  return { ok: true, image, engine, spec }
}

export function resolveLlmDockerModelPath(_backend, cfg = {}) {
  if (process.env.GIM_LLM_MODEL) return path.resolve(process.env.GIM_LLM_MODEL)
  return resolveColibriModelPath(cfg)
}

function validateColibriLinuxRoot(root) {
  if (!root) return { ok: false, detail: 'Colibri root not found — set GIM_COLIBRI_ROOT' }
  const coli = path.join(root, 'coli')
  if (!fs.existsSync(coli)) {
    return {
      ok: false,
      detail:
        'Colibri Docker needs Linux `coli` in GIM_COLIBRI_ROOT (mount Colibri tree with coli binary)',
    }
  }
  return { ok: true, coli }
}

export function isLlmDockerRunning(stack, backend = 'colibri') {
  const engine = detectContainerEngine()
  if (!engine.ok) return false
  const name = llmContainerName(stack, backend)
  const r = spawnSync(engine.bin, ['inspect', '-f', '{{.State.Running}}', name], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engine.bin),
  })
  return r.status === 0 && String(r.stdout).trim() === 'true'
}

export function getDockerPublishedPort(engineBin, containerName, internalPort = 8000) {
  const r = spawnSync(engineBin, ['port', containerName, String(internalPort)], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engineBin),
  })
  if (r.status !== 0) return null
  const line = String(r.stdout || '').trim().split('\n')[0] || ''
  const m = line.match(/:(\d+)\s*$/)
  return m ? Number(m[1]) : null
}

function containerExists(engineBin, name) {
  const r = spawnSync(engineBin, ['inspect', name], {
    encoding: 'utf8',
    windowsHide: true,
    env: engineEnv(engineBin),
  })
  return r.status === 0
}

async function waitLlmReady(url, apiKey, backend, timeoutMs = 600_000) {
  await waitHttpOk(`${url}/models`, {
    timeoutMs,
    intervalMs: 5000,
    label: `llm-${backend}`,
    headers: { Authorization: `Bearer ${apiKey}` },
  })
}

/**
 * @returns {Promise<{ ok: boolean, containerName?: string, port?: number, url?: string, backend?: string, warming?: boolean, reused?: boolean, detail?: string }>}
 */
export async function startLlmDocker({
  stack,
  backend = 'colibri',
  port,
  modelPath,
  ctx,
  ramGb = Number(process.env.GIM_COLIBRI_RAM || 48),
  modelId = process.env.GIM_LLM_MODEL_ID || process.env.GIM_COLIBRI_MODEL_ID || 'default',
  cfg = {},
  forceRecreate = false,
} = {}) {
  assertLlmDockerPlatform()
  backend = backend === 'vllm' ? 'vllm' : 'colibri'

  const ensured = await ensureLlmDockerImage(backend)
  if (!ensured.ok) return { ok: false, detail: ensured.reason }

  const { engine, image, spec } = ensured
  const internalPort = spec.internalPort || 8000
  const name = llmContainerName(stack, backend)
  const model = modelPath || resolveLlmDockerModelPath(backend, cfg)
  const ready = colibriModelReady(model)
  if (!ready.ok) return { ok: false, detail: ready.detail }

  const contextTokens = ctx ?? resolveContextWindow(cfg, {})
  const apiKey = process.env.GIM_COLIBRI_API_KEY || process.env.VLLM_API_KEY || 'sk-gim-llm-docker'
  const cacheDir = ensureLlmCacheDirs(model)
  const cacheId = llmCacheId(model)

  if (!forceRecreate && isLlmDockerRunning(stack, backend)) {
    const published = getDockerPublishedPort(engine.bin, name, internalPort) || port
    const url = `http://127.0.0.1:${published}/v1`
    try {
      await waitLlmReady(url, apiKey, backend, 120_000)
      console.log(`[GREEN] LLM Docker reused (warm) ${name} :${published}`)
      appendLog(`event=llm_docker_reuse backend=${backend} stack=${stack} port=${published}`)
      return {
        ok: true,
        reused: true,
        containerName: name,
        port: published,
        url,
        backend,
        ctx: contextTokens,
        modelPath: model,
        cacheId,
      }
    } catch {
      console.log('[YELLOW] Warm container unhealthy — recreating')
    }
  }

  if (!forceRecreate && containerExists(engine.bin, name)) {
    spawnSync(engine.bin, ['start', name], {
      encoding: 'utf8',
      windowsHide: true,
      env: engineEnv(engine.bin),
    })
    const published = getDockerPublishedPort(engine.bin, name, internalPort) || port
    const url = `http://127.0.0.1:${published}/v1`
    try {
      await waitLlmReady(url, apiKey, backend, 600_000)
      console.log(`[GREEN] LLM Docker restarted ${name} :${published}`)
      return {
        ok: true,
        reused: true,
        containerName: name,
        port: published,
        url,
        backend,
        ctx: contextTokens,
        modelPath: model,
        cacheId,
      }
    } catch {
      spawnSync(engine.bin, ['rm', '-f', name], {
        encoding: 'utf8',
        windowsHide: true,
        env: engineEnv(engine.bin),
      })
    }
  } else if (forceRecreate || !llmKeepWarm()) {
    spawnSync(engine.bin, ['rm', '-f', name], {
      encoding: 'utf8',
      windowsHide: true,
      env: engineEnv(engine.bin),
    })
  }

  const modelMount = `${toContainerHostPath(model)}:/model`
  const cacheMount = `${toContainerHostPath(cacheDir)}:/gim-cache`
  const autoTune = shouldRunAutoTune(model)

  /** @type {string[]} */
  const runArgs = [
    'run',
    '-d',
    '--name',
    name,
    '--label',
    `gim.cacheId=${cacheId}`,
    '--label',
    `gim.backend=${backend}`,
    '-p',
    `127.0.0.1:${port}:${internalPort}`,
    '-v',
    modelMount,
    '-v',
    cacheMount,
    '-e',
    `COLI_API_KEY=${apiKey}`,
    '-e',
    `GIM_CACHE_MIRROR=/gim-cache/mirror`,
    '-e',
    `GIM_XDG_CACHE=/gim-cache/xdg`,
    '-e',
    `GIM_COLIBRI_AUTO_TUNE=${autoTune ? '1' : '0'}`,
  ]

  if (spec.shmSize) runArgs.push('--shm-size', spec.shmSize)
  if (spec.ipc) runArgs.push('--ipc', spec.ipc)
  runArgs.push(...dockerGpuArgs(engine.bin))

  if (backend === 'colibri') {
    const root = resolveColibriRoot()
    const linuxColi = validateColibriLinuxRoot(root)
    if (!linuxColi.ok) return { ok: false, detail: linuxColi.detail }
    const colMount = `${toContainerHostPath(root)}:/colibri:ro`
    runArgs.push('-v', colMount)
    runArgs.push(
      '-e',
      `COLI_CTX=${contextTokens}`,
      '-e',
      `COLI_RAM=${ramGb}`,
      '-e',
      `COLI_MODEL_ID=${modelId}`,
      '-e',
      `COLI_MODEL=/model`,
    )
    runArgs.push(...dockerEnvArgs(universalColibriSpeedEnv({ ramGb, ctx: contextTokens })))
    runArgs.push(image)
  } else {
    runArgs.push(image)
    runArgs.push(
      '--model',
      '/model',
      '--host',
      '0.0.0.0',
      '--port',
      String(internalPort),
      '--max-model-len',
      String(contextTokens),
      '--trust-remote-code',
    )
  }

  console.log(`[INFO] LLM Docker ${backend} → ${name} :${port} cache=${cacheId}`)
  const run = spawnSync(engine.bin, runArgs, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: engineEnv(engine.bin),
  })
  if (run.status !== 0) {
    return { ok: false, detail: (run.stderr || run.stdout || 'docker run failed').slice(0, 300) }
  }

  if (autoTune && backend === 'colibri') {
    markAutoTuneDone(model)
  }

  const url = `http://127.0.0.1:${port}/v1`
  try {
    await waitLlmReady(url, apiKey, backend, 600_000)
  } catch (e) {
    const logs = spawnSync(engine.bin, ['logs', '--tail', '40', name], {
      encoding: 'utf8',
      windowsHide: true,
      env: engineEnv(engine.bin),
    })
    const tail = (logs.stdout || logs.stderr || '').slice(-400)
    appendLog(`event=llm_docker_warming backend=${backend} port=${port}`)
    return {
      ok: true,
      warming: true,
      containerName: name,
      port,
      url,
      backend,
      cacheId,
      detail: `${e.message}${tail ? `\n--- logs ---\n${tail}` : ''}`,
    }
  }

  appendLog(`event=llm_docker_start backend=${backend} stack=${stack} port=${port} ctx=${contextTokens}`)
  return { ok: true, containerName: name, port, url, backend, ctx: contextTokens, modelPath: model, cacheId }
}

export function stopLlmDocker(stack, backend = 'colibri', engineBin = null, { remove = true } = {}) {
  const engine = engineBin || detectContainerEngine().bin
  if (!engine) return
  const name = llmContainerName(stack, backend)
  if (remove) {
    spawnSync(engine, ['rm', '-f', name], {
      encoding: 'utf8',
      windowsHide: true,
      env: engineEnv(engine),
    })
    appendLog(`event=llm_docker_stop name=${name} remove=1`)
  } else {
    spawnSync(engine, ['stop', name], {
      encoding: 'utf8',
      windowsHide: true,
      env: engineEnv(engine),
    })
    appendLog(`event=llm_docker_stop name=${name} remove=0`)
  }
}

export { llmKeepWarm }
