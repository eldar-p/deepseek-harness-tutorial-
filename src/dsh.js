import fs from 'node:fs'
import path from 'node:path'
import { which, engineEnv, resolveEngineBin } from './detect.js'
import { paths, appendLog, PKG_ROOT } from './paths.js'
import { spawnDetached, killTree, waitHttpOk, runLogPath, isPidAlive } from './proc.js'
import { loadManifest } from './download.js'
import { buildDshApiYaml } from './api-provider.js'

export function resolveDshBin() {
  if (process.env.GIM_DSH_BIN && fs.existsSync(process.env.GIM_DSH_BIN)) return process.env.GIM_DSH_BIN
  const found = which('dsh')
  if (!found) return null
  if (process.platform === 'win32') {
    const cmd = found.endsWith('.cmd') ? found : `${found}.cmd`
    if (fs.existsSync(cmd)) return cmd
    // npm shim without extension — prefer adjacent .cmd
    if (fs.existsSync(`${found}.cmd`)) return `${found}.cmd`
  } else {
    // WSL often sees the Windows npm shim on PATH via /mnt/c — reject it.
    const norm = found.replace(/\\/g, '/')
    if (/^\/mnt\/[a-z]\//i.test(norm) || /AppData\/Roaming\/npm/i.test(norm)) {
      return null
    }
  }
  return found
}

/** Write $DSH_HOME/settings.yaml — local llama OR cloud API profile. */
export function writeDshRuntimeSettings({
  llamaPort,
  contextWindow = Number(process.env.GIM_LLAMA_CTX || 32768),
  apiProfile = null,
}) {
  const dshHome = paths().dshHome
  fs.mkdirSync(dshHome, { recursive: true })

  let yaml
  if (apiProfile) {
    yaml = buildDshApiYaml(apiProfile)
  } else {
    const baseURL = `http://127.0.0.1:${llamaPort}/v1`
    yaml = `agent-default-model:
  provider: llama
  model: coder

llm-pi-ai:
  providers:
    llama:
      displayName: llama.cpp
      apiKeyEnv: GIM_LLAMA_API_KEY
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
  }

  const settingsPath = path.join(dshHome, 'settings.yaml')
  fs.writeFileSync(settingsPath, yaml, 'utf8')

  const envPath = path.join(dshHome, '.env')
  if (apiProfile) {
    if (apiProfile.apiKey) {
      let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
      const line = `${apiProfile.apiKeyEnv}=${apiProfile.apiKey}`
      const re = new RegExp(`^${apiProfile.apiKeyEnv}=.*$`, 'm')
      text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`
      fs.writeFileSync(envPath, text, 'utf8')
    }
  } else {
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, 'GIM_LLAMA_API_KEY=sk-gim-local\n', 'utf8')
    } else if (!fs.readFileSync(envPath, 'utf8').includes('GIM_LLAMA_API_KEY')) {
      fs.appendFileSync(envPath, '\nGIM_LLAMA_API_KEY=sk-gim-local\n', 'utf8')
    }
  }

  // seed profile patch if missing (lightweight — full guest-exec in t5)
  const profileDir = path.join(dshHome, 'profiles', 'web')
  fs.mkdirSync(path.join(profileDir, 'dsh-plugins'), { recursive: true })
  const patchDst = path.join(profileDir, 'cordis.patch.yml')
  const patchSrc = path.join(PKG_ROOT, 'assets', 'cordis.gim.patch.yml')
  if (!fs.existsSync(patchDst) && fs.existsSync(patchSrc)) {
    fs.copyFileSync(patchSrc, patchDst)
  }

  void yaml
  return settingsPath
}

/**
 * Start DSH web on host if binary available.
 */
export async function startDsh({ stack, port, llamaPort, guestName = null, engineBin = null, indexPort = null, apiProfile = null }) {
  const bin = resolveDshBin()
  if (!bin) {
    return { ok: false, detail: 'dsh not on PATH — npm i -g @deepseek-ai/dsh@0.1.1-rc.2' }
  }
  const pin = loadManifest('dsh-pin.json')
  const dshHome = paths().dshHome
  const workspace = paths(stack).workspace
  writeDshRuntimeSettings({ llamaPort, apiProfile, contextWindow: apiProfile?.contextWindow })
  const { writeGimProfilePatch } = await import('./materialize.js')
  writeGimProfilePatch(stack)
  const logFile = runLogPath(stack, 'dsh')
  const dockerBin = engineBin || resolveEngineBin('docker') || process.env.GIM_ENGINE || 'docker'
  const env = {
    ...engineEnv(typeof dockerBin === 'string' ? dockerBin : null),
    DSH_HOME: dshHome,
    GIM_LLAMA_API_KEY: process.env.GIM_LLAMA_API_KEY || 'sk-gim-local',
    GIM_WORKSPACE: workspace,
    GIM_PKG_ROOT: PKG_ROOT,
    HOST_SHARE: workspace,
    GIM_GUEST_NAME: guestName || `gim-guest-${stack}`,
    GIM_ENGINE: engineBin || (typeof dockerBin === 'string' ? dockerBin : 'docker'),
    ...(indexPort ? { GIM_INDEX_URL: `http://127.0.0.1:${indexPort}` } : {}),
    ...(apiProfile?.apiKeyEnv && process.env[apiProfile.apiKeyEnv]
      ? {}
      : apiProfile?.apiKey
        ? { [apiProfile.apiKeyEnv]: apiProfile.apiKey }
        : {}),
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
