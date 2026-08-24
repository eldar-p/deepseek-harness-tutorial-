#!/usr/bin/env node
/**
 * Agent harness test pack — offline guardrail + API mock checks (no Docker required).
 *
 * Usage:
 *   npm run test:harness
 *   deep test harness
 *   node scripts/harness-test-pack.mjs [--json]
 *
 * Scenarios: docs/HARNESS-TEST-PACK.md
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assessPolicyScore } from '../src/policy-score.js'
import { classifyBashRisk, classifyWriteRisk } from '../src/permission-risk.js'
import { isPathInsideRoot } from '../src/workspace-jail.js'
import { resolveApiProfile, buildDshApiYaml } from '../src/api-provider.js'
import { searchDeferredTools } from '../src/tool-search.js'
import { callMcpTool } from '../src/mcp-server.js'
import { PKG_ROOT } from '../src/paths.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const asJson = process.argv.includes('--json')

/** @type {{ id: string, ok: boolean, detail: string }[]} */
const results = []

function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail: String(detail || '') })
}

// 1 Policy score
const policy = assessPolicyScore()
check('policy-score', policy.pct >= 90, `grade ${policy.grade} ${policy.pct}%`)

// 2 Jail
const root = path.join(ROOT, 'src')
check('jail-inside', isPathInsideRoot(path.join(root, 'cli.js'), root), 'cli.js inside src')
check(
  'jail-escape',
  !isPathInsideRoot(path.join(root, '..', 'package.json'), root),
  'package.json not inside src',
)

// 3 Risk fixtures
check('risk-rm', classifyBashRisk('rm -rf /').level === 'deny', 'rm -rf deny')
check('risk-ls', classifyBashRisk('ls -la').level === 'allow', 'ls allow')
check('risk-env', classifyWriteRisk('.env').level === 'deny', '.env write deny')
check('risk-src', classifyWriteRisk('src/foo.js').level === 'allow', 'src write allow')

// 4 Tool search
check('tool-search', searchDeferredTools('lsp').some((t) => t.id === 'lsp_query'), 'lsp_query hit')

// 5 MCP tool_search (in-process)
{
  const out = await callMcpTool('tool_search', { query: 'egress' })
  check('mcp-tool-search', /egress_proxy/.test(out.content?.[0]?.text || ''), 'egress in catalog')
}

// 6 API profile smoke (mock key)
{
  const profile = resolveApiProfile({ api: 'deepseek', 'api-key': 'sk-smoke' }, null)
  const yaml = buildDshApiYaml(profile)
  check('api-yaml', yaml.includes(profile.model), `model ${profile.model}`)
}

// 7 smoke-api script exit 0
{
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'smoke-api.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  check('smoke-api', r.status === 0, `exit ${r.status}`)
}

const failed = results.filter((r) => !r.ok)
const summary = {
  pack: 'harness-test-pack',
  ok: failed.length === 0,
  passed: results.filter((r) => r.ok).length,
  failed: failed.length,
  total: results.length,
  policy: { pct: policy.pct, grade: policy.grade },
  results,
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log('Deep harness test pack')
  console.log('─'.repeat(48))
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(18)} ${r.detail}`)
  }
  console.log('─'.repeat(48))
  console.log(
    `${summary.ok ? 'OK' : 'FAIL'} ${summary.passed}/${summary.total}  policy=${policy.pct}% (${policy.grade})`,
  )
  console.log(`Docs: ${path.join(PKG_ROOT, 'docs', 'HARNESS-TEST-PACK.md')}`)
}

process.exit(summary.ok ? 0 : 1)
