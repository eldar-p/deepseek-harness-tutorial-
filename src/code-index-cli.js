import { paths } from './paths.js'
import { buildIndex, searchIndex, indexStatus, defaultIndexDir } from './code-index/indexer.js'
import { readRunState } from './runstate.js'
import { aiInstructionsPath, refreshAiInstructions } from './instructions.js'
import fs from 'node:fs'

function stackPaths(stack) {
  const p = paths(stack)
  return { workspace: p.workspace, indexDir: defaultIndexDir(p.workspace) }
}

export async function cmdIndexBuild(flags) {
  const stack = flags.name || 'default'
  const { workspace, indexDir } = stackPaths(stack)
  const run = readRunState(stack)
  const llamaBase = run?.urls?.llama
  console.log(`[INFO] Indexing ${workspace} → ${indexDir}`)
  const r = await buildIndex({
    workspaceRoot: workspace,
    indexDir,
    llamaBase,
    force: flags.force === true,
    onProgress: (m) => process.stdout.write(`\r[INFO] ${m}    `),
  })
  console.log('')
  const inc = r.incremental ? `, ${r.skippedFiles} skipped, ${r.indexedFiles} re-indexed` : ''
  console.log(`[OK] Index built: ${r.chunkCount} chunks from ${r.fileCount} files (${r.backend}${inc})`)
  if (process.env.GIM_INSTRUCTIONS_ON_INDEX !== '0' && fs.existsSync(aiInstructionsPath(stack))) {
    const refreshed = refreshAiInstructions(stack)
    console.log(`[OK] Instructions refreshed (${refreshed.scriptCount} scripts, ${refreshed.mcpCount} MCP)`)
  }
}

export async function cmdIndexSearch(flags, queryParts) {
  const stack = flags.name || 'default'
  const query = queryParts.join(' ').trim()
  if (!query) {
    throw Object.assign(new Error('Usage: gim index search <query>'), { exitCode: 2 })
  }
  const { workspace, indexDir } = stackPaths(stack)
  const run = readRunState(stack)
  const r = await searchIndex({
    workspaceRoot: workspace,
    indexDir,
    query,
    llamaBase: run?.urls?.llama,
    limit: Number(flags.limit) || 8,
    stack,
  })
  if (!r.ok) {
    console.log(`[WARN] ${r.error}`)
    return
  }
  for (const h of r.hits) {
    console.log(`${h.path}:${h.startLine}-${h.endLine}  ${h.kind} ${h.symbol}  score=${h.score}`)
    console.log(`  ${h.preview.replace(/\s+/g, ' ').slice(0, 200)}`)
  }
  console.log(`(${r.hits.length} hits, backend=${r.backend})`)
}

export async function cmdIndexStatus(flags) {
  const stack = flags.name || 'default'
  const { indexDir } = stackPaths(stack)
  const s = indexStatus(indexDir)
  const { assessLanceBackend, lanceEnabled } = await import('./code-index/store.js')
  const lance = await assessLanceBackend()
  console.log(`Index: ${indexDir}`)
  console.log(`Backend: ${s.backend}`)
  console.log(`Chunks: ${s.chunkCount}`)
  console.log(`Files: ${s.fileCount}`)
  if (s.sharded) console.log(`Shards: enabled`)
  if (s.incremental) {
    console.log(`Last build: ${s.indexedFiles} indexed, ${s.skippedFiles} unchanged`)
  }
  console.log(`Built: ${s.builtAt || 'never'}`)
  console.log(`LanceDB: ${lance.available ? 'available (auto when deps installed)' : lance.reason}${lanceEnabled() ? '' : ' [disabled GIM_INDEX_LANCE=0]'}`)
}

export async function cmdIndexSidecar() {
  const { assessIndexSidecar, formatIndexSidecarReport } = await import('./index-sidecar.js')
  const report = await assessIndexSidecar()
  console.log(formatIndexSidecarReport(report))
}

/**
 * Benchmark search latency (local + HTTP if live).
 * Usage: gim index bench [query...] [--name STACK] [--rounds N]
 */
export async function cmdIndexBench(flags, queryParts) {
  const stack = flags.name || 'default'
  const { workspace, indexDir } = stackPaths(stack)
  const run = readRunState(stack)
  const rounds = Math.max(1, Number(flags.rounds) || 3)
  const queries = queryParts.length
    ? [queryParts.join(' ').trim()]
    : ['function export', 'class', 'auth token login']
  const st = indexStatus(indexDir)
  if (!st.chunkCount) {
    console.log('[WARN] index empty — run: gim index build')
    process.exitCode = 1
    return
  }

  console.log(`[INFO] bench stack=${stack} chunks=${st.chunkCount} backend=${st.backend} rounds=${rounds}`)
  /** @type {{ query: string, path: string, ms: number, hits: number }[]} */
  const rows = []

  for (const query of queries) {
    for (let i = 0; i < rounds; i++) {
      const t0 = performance.now()
      const r = await searchIndex({
        workspaceRoot: workspace,
        indexDir,
        query,
        llamaBase: run?.urls?.llama,
        limit: 8,
        stack,
        localOnly: true,
      })
      rows.push({
        query,
        path: 'local',
        ms: Number((performance.now() - t0).toFixed(1)),
        hits: r.hits?.length || 0,
      })
    }
    if (run?.urls?.index || process.env.GIM_INDEX_URL) {
      for (let i = 0; i < rounds; i++) {
        const t0 = performance.now()
        const r = await searchIndex({
          workspaceRoot: workspace,
          indexDir,
          query,
          llamaBase: run?.urls?.llama,
          limit: 8,
          stack,
        })
        rows.push({
          query,
          path: 'http',
          ms: Number((performance.now() - t0).toFixed(1)),
          hits: r.hits?.length || 0,
        })
      }
    }
  }

  for (const row of rows) {
    console.log(`  ${row.path.padEnd(6)} ${String(row.ms).padStart(8)} ms  hits=${row.hits}  q="${row.query}"`)
  }
  const byPath = { local: rows.filter((r) => r.path === 'local'), http: rows.filter((r) => r.path === 'http') }
  for (const [name, list] of Object.entries(byPath)) {
    if (!list.length) continue
    const ms = list.map((r) => r.ms).sort((a, b) => a - b)
    const mean = ms.reduce((a, b) => a + b, 0) / ms.length
    const p50 = ms[Math.floor(ms.length / 2)]
    console.log(`[OK] ${name}  mean=${mean.toFixed(1)}ms  p50=${p50}ms  n=${ms.length}`)
  }
}
