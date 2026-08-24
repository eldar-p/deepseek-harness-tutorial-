/**
 * Static checks for GIM DSH plugins — catch the 1.1.1 lsp-bridge class of boot crashes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT } from './paths.js'

export function listPatchedPluginIds(patchText) {
  const ids = []
  for (const m of patchText.matchAll(/__PLUGIN_DIR__\/([a-z0-9-]+)\//gi)) {
    ids.push(m[1])
  }
  return [...new Set(ids)]
}

/**
 * @returns {{ ok: boolean, issues: { level: 'fail'|'warn', id: string, msg: string }[] }}
 */
export function validateDeepPlugins({ pluginRoot = path.join(PKG_ROOT, 'dsh-plugins') } = {}) {
  const issues = []
  const patchPath = path.join(PKG_ROOT, 'assets', 'cordis.gim.patch.yml')
  if (!fs.existsSync(patchPath)) {
    return { ok: false, issues: [{ level: 'fail', id: 'patch', msg: 'missing assets/cordis.gim.patch.yml' }] }
  }
  const patch = fs.readFileSync(patchPath, 'utf8')
  const ids = listPatchedPluginIds(patch)
  if (!ids.length) {
    issues.push({ level: 'warn', id: 'patch', msg: 'no __PLUGIN_DIR__ plugins in cordis patch' })
  }
  for (const id of ids) {
    const index = path.join(pluginRoot, id, 'index.mjs')
    if (!fs.existsSync(index)) {
      issues.push({ level: 'fail', id, msg: `missing ${path.relative(PKG_ROOT, index)}` })
      continue
    }
    const src = fs.readFileSync(index, 'utf8')
    if (/\bctx\.tool\s*\(/.test(src)) {
      issues.push({
        level: 'fail',
        id,
        msg: 'uses ctx.tool( — DSH boot crash; use defineTool + ctx.tools.register + output.render',
      })
    }
    if (/defineTool\s*\(/.test(src)) {
      if (!/\boutput\s*:/.test(src) || !/\brender\s*:/.test(src)) {
        issues.push({
          level: 'fail',
          id,
          msg: 'defineTool without output.render — DSH rejects plugin at boot',
        })
      }
      if (!/ctx\.tools\.register/.test(src) && !/\.register\s*\(\s*defineTool/.test(src)) {
        issues.push({
          level: 'warn',
          id,
          msg: 'defineTool present but ctx.tools.register not found',
        })
      }
    }
  }
  return { ok: !issues.some((i) => i.level === 'fail'), issues }
}

export function formatPluginValidation(result) {
  if (!result.issues.length) return '  plugins  OK (cordis patch)'
  const lines = []
  for (const i of result.issues) {
    lines.push(`  plugins  ${i.level.toUpperCase()}  ${i.id}: ${i.msg}`)
  }
  if (result.ok) lines.push('  plugins  OK (warns only)')
  else lines.push('  plugins  FAIL — fix before gim start (DSH may not boot)')
  return lines.join('\n')
}
