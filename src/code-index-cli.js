import { paths } from './paths.js'
import { buildIndex, searchIndex, indexStatus, defaultIndexDir } from './code-index/indexer.js'
import { readRunState } from './runstate.js'

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
    onProgress: (m) => process.stdout.write(`\r[INFO] ${m}    `),
  })
  console.log('')
  console.log(`[OK] Index built: ${r.chunkCount} chunks from ${r.fileCount} files (${r.backend})`)
}

export async function cmdIndexSearch(flags, queryParts) {
  const stack = flags.name || 'default'
  const query = queryParts.join(' ').trim()
  if (!query) {
    throw Object.assign(new Error('Usage: deep index search <query>'), { exitCode: 2 })
  }
  const { workspace, indexDir } = stackPaths(stack)
  const run = readRunState(stack)
  const r = await searchIndex({
    workspaceRoot: workspace,
    indexDir,
    query,
    llamaBase: run?.urls?.llama,
    limit: Number(flags.limit) || 8,
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
  console.log(`Index: ${indexDir}`)
  console.log(`Backend: ${s.backend}`)
  console.log(`Chunks: ${s.chunkCount}`)
  console.log(`Built: ${s.builtAt || 'never'}`)
}
