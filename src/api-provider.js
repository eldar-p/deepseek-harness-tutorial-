import fs from 'node:fs'
import path from 'node:path'
import { paths, chmodOwnerOnly } from './paths.js'
import { loadManifest } from './download.js'
import { resolveContextWindow } from './context-policy.js'

/** @typedef {{ id: string, displayName: string, baseURL: string, model: string, apiKeyEnv: string, apiKey: string|null, contextWindow: number, maxTokens: number, supportsDeveloperRole: boolean }} ApiProfile */

export function listApiProviderIds() {
  const man = loadManifest('api-providers.json')
  return Object.keys(man)
}

/**
 * @param {{ api?: string, 'api-model'?: string, 'api-base'?: string, 'api-key'?: string, 'api-ctx'?: string }} flags
 * @param {object|null} cfg
 * @returns {ApiProfile}
 */
export function resolveApiProfile(flags = {}, cfg = null) {
  const man = loadManifest('api-providers.json')
  const id = (flags.api || cfg?.api?.provider || '').toLowerCase().trim()
  if (!id) {
    throw Object.assign(new Error('No API provider — use --api openai|deepseek|openrouter|groq|together|custom'), {
      exitCode: 2,
    })
  }
  const preset = man[id]
  if (!preset) {
    throw Object.assign(
      new Error(`Unknown API provider: ${id}. Allowed: ${Object.keys(man).join(', ')}`),
      { exitCode: 2 },
    )
  }

  const model = flags['api-model'] || cfg?.api?.model || preset.defaultModel
  const baseURL = (
    flags['api-base'] ||
    cfg?.api?.baseURL ||
    preset.baseURL ||
    ''
  ).replace(/\/$/, '')

  if (!baseURL) {
    throw Object.assign(
      new Error(`Provider ${id} needs --api-base URL (OpenAI-compatible /v1 endpoint)`),
      { exitCode: 2 },
    )
  }

  const apiKeyEnv = preset.apiKeyEnv || 'GIM_API_KEY'
  const apiKey = flags['api-key'] || process.env[apiKeyEnv] || null

  return {
    id,
    displayName: preset.displayName || id,
    baseURL,
    model,
    apiKeyEnv,
    apiKey,
    contextWindow: resolveContextWindow(cfg || {}, flags, null),
    maxTokens: Number(preset.maxTokens || 4096),
    supportsDeveloperRole: preset.supportsDeveloperRole === true,
  }
}

export function saveApiToConfig(cfg, profile) {
  cfg.api = {
    provider: profile.id,
    model: profile.model,
    baseURL: profile.baseURL,
    apiKeyEnv: profile.apiKeyEnv,
    contextWindow: profile.contextWindow,
  }
  return cfg
}

export function writeApiKeyToDshEnv(profile) {
  if (!profile.apiKey) return
  const envPath = path.join(paths().dshHome, '.env')
  fs.mkdirSync(path.dirname(envPath), { recursive: true })
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  const line = `${profile.apiKeyEnv}=${profile.apiKey}`
  const re = new RegExp(`^${profile.apiKeyEnv}=.*$`, 'm')
  text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`
  fs.writeFileSync(envPath, text, 'utf8')
  chmodOwnerOnly(envPath)
}

export function isApiMode(cfg, flags = {}) {
  if (flags.gguf || cfg?.gguf) return false
  if (isVllmMode(cfg, flags)) return true
  return !!(flags.api || cfg?.api?.provider)
}

/** Local backends that do not require a cloud API key. */
export function isLocalApiProvider(id) {
  return id === 'vllm' || id === 'colibri'
}

export function isVllmMode(cfg, flags = {}) {
  if (flags.vllm === true || flags.vllm === '') return true
  if (flags.llm === 'vllm' || flags.backend === 'vllm') return true
  if (process.env.GIM_LLM === 'vllm' || process.env.GIM_BACKEND === 'vllm') return true
  if (cfg?.llm === 'vllm' || cfg?.backend === 'vllm') return true
  return false
}

export function buildDshApiYaml(profile) {
  const ctx = profile.contextWindow
  const devRole = profile.supportsDeveloperRole ? 'true' : 'false'
  return `agent-default-model:
  provider: ${profile.id}
  model: ${profile.model}

llm-pi-ai:
  providers:
    ${profile.id}:
      displayName: ${profile.displayName}
      apiKeyEnv: ${profile.apiKeyEnv}
      api: openai-completions
      baseURL: ${profile.baseURL}
      defaultContextWindow: ${ctx}
      defaultMaxTokens: ${profile.maxTokens}
      compat:
        supportsDeveloperRole: ${devRole}
        maxTokensField: max_tokens
      models:
        - id: ${profile.model}
          contextWindow: ${ctx}
          maxTokens: ${profile.maxTokens}
`
}
