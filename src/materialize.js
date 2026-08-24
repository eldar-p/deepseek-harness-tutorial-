import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT, paths } from './paths.js'

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

  const agentsSrc = path.join(PKG_ROOT, 'assets', 'AGENTS.deep.md')
  const agentsDst = path.join(p.dshHome, 'AGENTS.md')
  if (fs.existsSync(agentsSrc)) {
    fs.copyFileSync(agentsSrc, agentsDst)
  }

  writeDeepProfilePatch(stack)

  const ctx = path.join(p.workspace, '.deep', 'CONTEXT.md')
  fs.mkdirSync(path.dirname(ctx), { recursive: true })
  if (!fs.existsSync(ctx)) {
    fs.copyFileSync(path.join(PKG_ROOT, 'assets', 'CONTEXT.md'), ctx)
  }

  const memDir = path.join(p.workspace, '.deep')
  const memPath = path.join(memDir, 'memory.json')
  fs.mkdirSync(memDir, { recursive: true })
  if (!fs.existsSync(memPath)) {
    const tpl = path.join(PKG_ROOT, 'assets', 'memory.template.json')
    if (fs.existsSync(tpl)) fs.copyFileSync(tpl, memPath)
  }
}

export function writeDeepProfilePatch(stack = 'default') {
  const p = paths(stack)
  const profileDir = path.join(p.dshHome, 'profiles', 'web')
  fs.mkdirSync(profileDir, { recursive: true })
  const pluginDir = path.join(profileDir, 'dsh-plugins')
  const src = path.join(PKG_ROOT, 'assets', 'cordis.deep.patch.yml')
  if (!fs.existsSync(src)) return
  let text = fs.readFileSync(src, 'utf8')
  const pluginDirPosix = pluginDir.replace(/\\/g, '/')
  const workspacePosix = p.workspace.replace(/\\/g, '/')
  text = text.replaceAll('__PLUGIN_DIR__', pluginDirPosix)
  text = text.replaceAll('__WORKSPACE__', workspacePosix)
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), text, 'utf8')
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
