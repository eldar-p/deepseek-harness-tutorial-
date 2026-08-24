#!/usr/bin/env node
/**
 * GIM code index sidecar — JS implementation of the HTTP contract.
 * Replaceable by native `gim-index` binary (same flags / env).
 */
import { startCodeIndexFromEnv } from '../src/index-sidecar.js'

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) process.env.GIM_INDEX_PORT = args[++i]
  else if (args[i] === '--workspace' && args[i + 1]) process.env.GIM_WORKSPACE = args[++i]
  else if (args[i] === '--llama-url' && args[i + 1]) process.env.GIM_LLAMA_URL = args[++i]
}

await startCodeIndexFromEnv()
