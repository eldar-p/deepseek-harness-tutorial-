#!/usr/bin/env node
/**
 * Download official DeepSeek-V4-Flash-0731 safetensors to E:\models (for Colibri).
 * Usage: node scripts/download-colibri-model.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const dest = process.env.GIM_COLIBRI_MODEL || 'E:\\models\\DeepSeek-V4-Flash-0731'
const repo = 'deepseek-ai/DeepSeek-V4-Flash-0731'

fs.mkdirSync(dest, { recursive: true })
console.log(`[INFO] Downloading ${repo}`)
console.log(`[INFO] Destination: ${dest}`)
console.log('[INFO] ~167 GB — leave this running; safe to re-run (resumes)')

const env = {
  ...process.env,
  HF_XET_HIGH_PERFORMANCE: '1',
}

const child = spawn('hf', ['download', repo, '--local-dir', dest], {
  stdio: 'inherit',
  env,
  shell: true,
})

child.on('exit', (code) => {
  const shards = fs.existsSync(dest)
    ? fs.readdirSync(dest).filter((f) => f.endsWith('.safetensors')).length
    : 0
  console.log(`[INFO] safetensors shards present: ${shards}`)
  if (code === 0 && shards > 0) {
    console.log('[OK] Model ready for: gim start --colibri')
  }
  process.exit(code ?? 1)
})
