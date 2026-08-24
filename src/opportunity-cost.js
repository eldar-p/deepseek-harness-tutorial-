/**
 * Performance opportunity checklist (KI factors) — code-side, not money.
 * Complements Colibri speed hints with index / tools / MCP gaps.
 */
import fs from 'node:fs'
import { paths } from './paths.js'
import { indexStatus, defaultIndexDir } from './code-index/indexer.js'
import { assessLanceBackend } from './code-index/store.js'
import { listAvailableServers } from './lsp-bridge.js'
import { resolveNativeIndexSidecarBin, resolveLocalIndexSidecarBuild } from './index-sidecar.js'
import { countMcpSubscriptions, mcpPollEnabled, mcpPollIntervalMs } from './mcp-subscriptions.js'
import { readRunState } from './runstate.js'
import { summarizeAgentMetrics, formatMetricsSummary } from './metrics.js'
import { embedMode } from './code-index/embedder.js'

/**
 * @param {string} [stack]
 * @returns {Promise<{ factors: { id: string, weight: number, lost: boolean, detail: string, fix?: string }[], K: number, level: string }>}
 */
export async function assessOpportunityCost(stack = 'default') {
  /** @type {{ id: string, weight: number, lost: boolean, detail: string, fix?: string }[]} */
  const factors = []

  const run = readRunState(stack)
  const indexDir = defaultIndexDir(paths(stack).workspace)
  const idx = indexStatus(indexDir)
  const lance = await assessLanceBackend()
  const native = resolveNativeIndexSidecarBin()
  const localBuild = resolveLocalIndexSidecarBuild()
  const lsp = listAvailableServers()
  const lspOk = lsp.some((s) => s.ok)

  factors.push({
    id: 'llm_warm',
    weight: 0.35,
    lost: !(run?.urls?.llama && run?.pids?.llama),
    detail: run?.urls?.llama ? 'LLM URL present' : 'no running LLM for stack',
    fix: 'gim start (Colibri ELF or --gguf) · GIM_LLM_KEEP=1',
  })

  factors.push({
    id: 'index_built',
    weight: 0.15,
    lost: !(idx.chunkCount > 0),
    detail: idx.chunkCount > 0 ? `${idx.chunkCount} chunks (${idx.backend})` : 'index empty',
    fix: 'gim index build',
  })

  factors.push({
    id: 'index_http',
    weight: 0.08,
    lost: !run?.urls?.index,
    detail: run?.urls?.index ? `sidecar ${run.urls.index}` : 'index HTTP not running',
    fix: 'gim start (spawns code-index)',
  })

  factors.push({
    id: 'index_native',
    weight: 0.07,
    lost: !(native || localBuild),
    detail: native ? `native (${native.source})` : localBuild ? `local-build ${localBuild}` : 'JS sidecar only',
    fix: 'cd sidecar/gim-index && cargo build --release · or pin manifest URL',
  })

  factors.push({
    id: 'lance',
    weight: 0.05,
    lost: !lance.available,
    detail: lance.available ? 'LanceDB available' : lance.reason || 'missing',
    fix: 'cd optional/code-index && npm install',
  })

  factors.push({
    id: 'lsp',
    weight: 0.12,
    lost: !lspOk,
    detail: lspOk ? `LSP: ${lsp.filter((s) => s.ok).map((s) => s.id).join(',')}` : 'no language server on PATH',
    fix: 'npm i -g typescript-language-server typescript · or pyright',
  })

  factors.push({
    id: 'deferred_tools',
    weight: 0.05,
    lost: process.env.GIM_DEFERRED_TOOLS === '0',
    detail: process.env.GIM_DEFERRED_TOOLS === '0' ? 'deferred tools OFF (fat toolset)' : 'deferred tools on',
    fix: 'unset GIM_DEFERRED_TOOLS (default on)',
  })

  const subs = countMcpSubscriptions(stack)
  factors.push({
    id: 'mcp_poll',
    weight: 0.03,
    lost: subs > 0 && mcpPollEnabled() && mcpPollIntervalMs() < 1000,
    detail:
      subs === 0
        ? 'no MCP subscriptions'
        : `poll every ${mcpPollIntervalMs()}ms (${subs} subs)`,
    fix: 'GIM_MCP_POLL_MS=5000 (default) · GIM_MCP_POLL=0 to disable',
  })

  factors.push({
    id: 'shards',
    weight: 0.02,
    lost: idx.chunkCount > 0 && idx.sharded === false,
    detail: idx.sharded ? 'shards on' : idx.chunkCount ? 'monolithic chunks.json' : 'n/a',
    fix: 'GIM_INDEX_SHARDS unset (default on) · rebuild index',
  })

  factors.push({
    id: 'embed',
    weight: 0.08,
    lost: embedMode() === 'hash' || (embedMode() === 'auto' && !run?.urls?.llama),
    detail:
      embedMode() === 'hash'
        ? 'GIM_INDEX_EMBED=hash'
        : run?.urls?.llama
          ? `embed mode=${embedMode()} (llama URL present)`
          : 'no LLM URL for /v1/embeddings — hash fallback',
    fix: 'gim start then rebuild index · GIM_INDEX_EMBED=auto',
  })

  const lostWeight = factors.filter((f) => f.lost).reduce((s, f) => s + f.weight, 0)
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const K = totalWeight > 0 ? Number((lostWeight / totalWeight).toFixed(2)) : 0
  const level = K >= 0.55 ? 'red' : K >= 0.3 ? 'yellow' : 'green'

  return { stack, factors, K, level, lostWeight, totalWeight }
}

/**
 * @param {Awaited<ReturnType<typeof assessOpportunityCost>>} report
 */
export function formatOpportunityCostReport(report) {
  const lines = [
    `Performance opportunity (KI)  stack=${report.stack}  K≈${report.K}  (${report.level})`,
    '  K = share of weighted speed factors currently "left on the table"',
    '─'.repeat(52),
  ]
  for (const f of report.factors) {
    const tag = f.lost ? 'LOST' : 'OK  '
    lines.push(`  [${tag}] ${f.id.padEnd(14)} w=${f.weight.toFixed(2)}  ${f.detail}`)
    if (f.lost && f.fix) lines.push(`         → ${f.fix}`)
  }
  lines.push('─'.repeat(52))
  lines.push(`Estimate: ~${Math.round(report.K * 100)}% of session speed still reclaimable on this machine`)
  lines.push(formatMetricsSummary(summarizeAgentMetrics()))
  lines.push('Measure: gim index bench · gim doctor --speed · gim metrics')
  return lines.join('\n')
}
