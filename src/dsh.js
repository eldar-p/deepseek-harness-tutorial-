import fs from 'node:fs'
import path from 'node:path'
import { which } from './detect.js'
import { paths, appendLog, PKG_ROOT } from './paths.js'
import { spawnDetached, killTree, waitHttpOk, runLogPath, isPidAlive } from './proc.js'
import { loadManifest } from './download.js'

export function resolveDshBin() {
  if (process.env.DEEP_DSH_BIN && fs.existsSync(process.env.DEEP_DSH_BIN)) return process.env.DEEP_DSH_BIN
  const found = which('dsh')
  if (!found) return null
  if (process.platform === 'win32') {
    const cmd = found.endsWith('.cmd') ? found : `${found}.cmd`
    if (fs.existsSync(cmd)) return cmd
    // npm shim without extension — prefer adjacent .cmd
    if (fs.existsSync(`${found}.cmd`)) return `${found}.cmd`
  }
  return found
}

/** Write $DSH_HOME/settings.yaml pointing at local llama-server. */
export function writeDshRuntimeSettings({ llamaPort, contextWindow = 8192 }) {
  const dshHome = paths().dshHome
  fs.mkdirSync(dshHome, { recursive: true })
  const baseURL = `http://127.0.0.1:${llamaPort}/v1`
  const settings = {
    'agent-default-model': {
      provider: 'llama',
      model: 'coder',
    },
    'llm-pi-ai': {
      providers: {
        llama: {
          displayName: 'llama.cpp',
          apiKeyEnv: 'DEEP_LLAMA_API_KEY',
          api: 'openai-completions',
          baseURL,
          defaultContextWindow: contextWindow,
          defaultMaxTokens: 4096,
          compat: {
            supportsDeveloperRole: false,
            maxTokensField: 'max_tokens',
          },
          models: [
            {
              id: 'coder',
              contextWindow,
              maxTokens: 4096,
            },
          ],
        },
      },
    },
  }
  // YAML-ish via JSON is invalid — write minimal YAML manually
  const yaml = `agent-default-model:
  provider: llama
  model: coder

llm-pi-ai:
  providers:
    llama:
      displayName: llama.cpp
      apiKeyEnv: DEEP_LLAMA_API_KEY
      api: openai-completions
      baseURL: ${baseURL}
      defaultContextWindow: ${contextWindow}
      defaultMaxTokens: 4096
      compat:
        supportsDeveloperRole: false
        maxTokensField: max_tokens
      models:
        - id: coder
          contextWindow: ${contextWindow}
          maxTokens: 4096
`
  const settingsPath = path.join(dshHome, 'settings.yaml')
  fs.writeFileSync(settingsPath, yaml, 'utf8')

  const envPath = path.join(dshHome, '.env')
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, 'DEEP_LLAMA_API_KEY=sk-deep-local\n', 'utf8')
  } else if (!fs.readFileSync(envPath, 'utf8').includes('DEEP_LLAMA_API_KEY')) {
    fs.appendFileSync(envPath, '\nDEEP_LLAMA_API_KEY=sk-deep-local\n', 'utf8')
  }

  // seed profile patch if missing (lightweight — full guest-exec in t5)
  const profileDir = path.join(dshHome, 'profiles', 'web')
  fs.mkdirSync(path.join(profileDir, 'dsh-plugins'), { recursive: true })
  const patchDst = path.join(profileDir, 'cordis.patch.yml')
  const patchSrc = path.join(PKG_ROOT, 'assets', 'cordis.deep.patch.yml')
  if (!fs.existsSync(patchDst) && fs.existsSync(patchSrc)) {
    fs.copyFileSync(patchSrc, patchDst)
  }

  void settings
  return settingsPath
}

/**
 * Start DSH web on host if binary available.
 */
export async function startDsh({ stack, port, llamaPort, guestName = null, engineBin = null }) {
  const bin = resolveDshBin()
  if (!bin) {
    return { ok: false, detail: 'dsh not on PATH — npm i -g @deepseek-ai/dsh@0.1.1-rc.2' }
  }
  const pin = loadManifest('dsh-pin.json')
  const dshHome = paths().dshHome
  const workspace = paths(stack).workspace
  writeDshRuntimeSettings({ llamaPort })
  const { writeDeepProfilePatch } = await import('./materialize.js')
  writeDeepProfilePatch(stack)
  const logFile = runLogPath(stack, 'dsh')
  const env = {
    DSH_HOME: dshHome,
    DEEP_LLAMA_API_KEY: process.env.DEEP_LLAMA_API_KEY || 'sk-deep-local',
    DEEP_WORKSPACE: workspace,
    HOST_SHARE: workspace,
    DEEP_GUEST_NAME: guestName || `deep-guest-${stack}`,
    DEEP_ENGINE: engineBin || process.env.DEEP_ENGINE || 'docker',
  }
  const args = ['web', '--port', String(port), '--host', '127.0.0.1', '--no-open']
  console.log(`[INFO] Starting DSH web :${port} (pin ${pin.version || '?'})`)
  const pid = spawnDetached(bin, args, { cwd: workspace, env, logFile })
  appendLog(`event=dsh_spawn pid=${pid} port=${port}`)
  try {
    await waitHttpOk(`http://127.0.0.1:${port}/`, { timeoutMs: 90_000, label: 'dsh' })
    return { ok: true, pid, port }
  } catch (e) {
    return { ok: false, pid, detail: e.message, port }
  }
}

export function stopDsh(pid, { emergency = false } = {}) {
  if (!pid) return
  killTree(pid, { force: emergency })
}

export function dshStatusFromRun(run) {
  if (!run?.pids?.dsh) return { level: 'red', detail: run?.dshSkip || 'not started' }
  if (!isPidAlive(run.pids.dsh)) return { level: 'red', detail: `dead pid=${run.pids.dsh}` }
  return { level: 'green', detail: run.urls?.dsh || `pid=${run.pids.dsh}` }
}
