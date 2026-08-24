import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths } from './paths.js'
import { validateDeepPlugins } from './plugin-validate.js'

/** file:///C|/Users/... style for DSH plugin URLs on Windows */
export function toFileUrl(absPath) {
  const resolved = path.resolve(absPath)
  if (process.platform === 'win32') {
    const norm = resolved.replace(/\\/g, '/')
    // C:/foo → file:///C|/foo
    const m = norm.match(/^([A-Za-z]):\/(.*)$/)
    if (m) return `file:///${m[1]}|/${m[2]}`
    return `file:///${norm}`
  }
  return `file://${resolved}`
}

/** Copy plugins/skills/config templates into dsh-home. */
export function materializeAssets(stack = 'default') {
  const p = paths(stack)
  fs.mkdirSync(p.dshHome, { recursive: true })
  const skillsDst = path.join(p.dshHome, 'skills')
  const pluginsDst = path.join(p.dshHome, 'profiles', 'web', 'dsh-plugins')
  fs.mkdirSync(skillsDst, { recursive: true })
  fs.mkdirSync(pluginsDst, { recursive: true })

  copyDir(path.join(PKG_ROOT, 'skills'), skillsDst)
  copyDir(path.join(PKG_ROOT, 'dsh-plugins'), pluginsDst)
  syncJailCore(pluginsDst)

  const agentsSrc = path.join(PKG_ROOT, 'assets', 'AGENTS.gim.md')
  const agentsDst = path.join(p.dshHome, 'AGENTS.md')
  if (fs.existsSync(agentsSrc)) {
    fs.copyFileSync(agentsSrc, agentsDst)
  }

  writeGimProfilePatch(stack)

  const ctx = path.join(p.workspace, '.gim', 'CONTEXT.md')
  fs.mkdirSync(path.dirname(ctx), { recursive: true })
  if (!fs.existsSync(ctx)) {
    fs.copyFileSync(path.join(PKG_ROOT, 'assets', 'CONTEXT.md'), ctx)
  }

  const memDir = path.join(p.workspace, '.gim')
  const memPath = path.join(memDir, 'memory.json')
  fs.mkdirSync(memDir, { recursive: true })
  if (!fs.existsSync(memPath)) {
    const tpl = path.join(PKG_ROOT, 'assets', 'memory.template.json')
    if (fs.existsSync(tpl)) fs.copyFileSync(tpl, memPath)
  }
}

export function writeGimProfilePatch(stack = 'default') {
  const p = paths(stack)
  const profileDir = path.join(p.dshHome, 'profiles', 'web')
  fs.mkdirSync(profileDir, { recursive: true })
  const pluginDir = path.join(profileDir, 'dsh-plugins')
  const src = path.join(PKG_ROOT, 'assets', 'cordis.gim.patch.yml')
  if (!fs.existsSync(src)) return
  let text = fs.readFileSync(src, 'utf8')
  // Windows DSH expects file:///C|/… (pipe) — toFileUrl builds that.
  text = text.replace(/file:\/\/\/__PLUGIN_DIR__\/([^'\s]+)/g, (_, rel) => {
    const abs = path.join(pluginDir, ...rel.split('/'))
    return toFileUrl(abs)
  })
  const workspacePosix = p.workspace.replace(/\\/g, '/')
  text = text.replaceAll('__WORKSPACE__', workspacePosix)
  text = text.replaceAll('__PLUGIN_DIR__', pluginDir.replace(/\\/g, '/'))
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), text, 'utf8')

  // Prefer repo tree for validation if materialize hasn't copied yet
  const root = fs.existsSync(path.join(pluginDir, 'lsp-bridge', 'index.mjs'))
    ? pluginDir
    : path.join(PKG_ROOT, 'dsh-plugins')
  const check = validateDeepPlugins({ pluginRoot: root })
  if (!check.ok) {
    const msg = check.issues
      .filter((i) => i.level === 'fail')
      .map((i) => `${i.id}: ${i.msg}`)
      .join('; ')
    console.log(`[YELLOW] Plugin validation: ${msg}`)
  }
}

function syncJailCore(pluginsDst) {
  const src = path.join(PKG_ROOT, 'src', 'workspace-jail.js')
  const dst = path.join(pluginsDst, 'workspace-jail-fs', 'jail-core.mjs')
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dst))) {
    let text = fs.readFileSync(src, 'utf8')
    text = text.replace(
      "export function rewriteWorkspacePath",
      "/** @sync src/workspace-jail.js */\nexport function rewriteWorkspacePath",
    )
    fs.writeFileSync(dst, text, 'utf8')
  }
  const riskSrc = path.join(PKG_ROOT, 'src', 'permission-risk.js')
  const riskDst = path.join(pluginsDst, 'one-shot-guard', 'permission-risk.mjs')
  if (fs.existsSync(riskSrc) && fs.existsSync(path.dirname(riskDst))) {
    fs.copyFileSync(riskSrc, riskDst)
  }
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dst, { recursive: true })
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name)
    const d = path.join(dst, ent.name)
    if (ent.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}
