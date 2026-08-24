/**
 * Hard runtime guard (tools/pre-execute -> deny).
 * - todo_write (always)
 * - bash: only pwd/ls/cd/--version/which/uname probes
 * - bash: --break-system-packages; bare pip install outside projects/
 * - write/edit: share-root README/LICENSE/CHANGELOG (ok under projects/)
 * - write/edit: emoji in code filenames or source contents
 *
 * Large work: <HOST_SHARE>/projects/<slug>/
 */
export const name = 'one-shot-guard'
export const inject = []

import { shouldDenyBash, shouldDenyBashAsync, shouldDenyWrite } from './permission-risk.mjs'

const DENY_TOOLS = new Set(['todo_write', 'TodoWrite', 'todoWrite'])

const CODE_EXT =
  /\.(py|pyw|js|mjs|cjs|ts|tsx|jsx|sh|bash|ps1|rs|go|java|kt|c|cc|cpp|h|hpp|cs|php|rb|lua|sql|yml|yaml|toml|json|css|html|vue|svelte|r|jl)$/i

const SHARE_ROOT_DOC =
  /^(readme|license|licence|changelog|contributing|authors)(\.(md|txt|rst))?$/i

// Strict pictographs + status emoji the model likes to sneak into prints.
// Do NOT use U+2600–U+27BF wholesale (false positives on arrows/math/dingbats).
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{1F1E0}-\u{1F1FF}\u{2705}\u{274C}\u{26A0}\u{2B50}\u{2764}\u{1F44D}\u{1F44E}\u{FE0F}]/u

function argsOf(exec) {
  const args = exec?.arguments ?? {}
  if (typeof args === 'string') {
    try {
      return JSON.parse(args)
    } catch {
      return {}
    }
  }
  return args && typeof args === 'object' ? args : {}
}

function bashCommand(exec) {
  const a = argsOf(exec)
  return a.command ?? a.cmd ?? ''
}

function writePath(exec) {
  const a = argsOf(exec)
  return String(a.file_path ?? a.path ?? a.filePath ?? a.target ?? '')
}

function writeContent(exec) {
  const a = argsOf(exec)
  return String(a.content ?? a.contents ?? a.new_string ?? a.newString ?? a.text ?? '')
}

function basename(p) {
  const norm = String(p).replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? norm.slice(i + 1) : norm
}

export function underProjects(p) {
  const norm = String(p).replace(/\\/g, '/').toLowerCase()
  return norm.includes('/projects/')
}

function isShareRootDoc(p) {
  if (!SHARE_ROOT_DOC.test(basename(p))) return false
  if (underProjects(p)) return false
  return true
}

function isWastefulSegment(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return true
  if (/^pwd$/i.test(s)) return true
  if (/^cd\s+(\/mnt\/hostshare|\/home\/[^/\s]+|~)\/?\s*$/i.test(s)) return true
  if (/^(python3?|node|nodejs)\s+--version$/i.test(s)) return true
  if (/^(python3?|node)\s+-V$/i.test(s)) return true
  if (/^which\s+(python3?|node|nodejs|pip3?)$/i.test(s)) return true
  if (/^command\s+-v\s+(python3?|node|nodejs|pip3?)$/i.test(s)) return true
  if (/^type\s+(python3?|node|nodejs)$/i.test(s)) return true
  if (/^uname(\s+-a)?$/i.test(s)) return true
  if (/^echo\s+['"]?ok['"]?$/i.test(s)) return true
  // python -c 'import sys; print(sys.version)' style env probes
  if (/^python3?\s+-c\s+['"].*(sys\.version|platform\.|sys\.executable).*$/i.test(s)) {
    return true
  }
  if (/^ls(\s+-[a-zA-Z]+)*(\s+(\/mnt\/hostshare\/?|\/home\/[^/\s]+\/?|\.|\/mnt\/hostshare\/?\*))?\s*$/i.test(s)) {
    return true
  }
  return false
}

export function isWastefulBash(command) {
  const cmd = String(command ?? '').replace(/\r/g, '').trim()
  if (!cmd) return false
  // Do not split on ';' — breaks python -c '...' probes
  const parts = cmd.split(/\n|&&/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return false
  return parts.every(isWastefulSegment)
}

export function isBadPip(command) {
  const cmd = String(command ?? '')
  if (/--break-system-packages/i.test(cmd)) return true
  if (!/\bpip3?\s+install\b/i.test(cmd)) return false
  if (/\/mnt\/hostshare\/projects\/|\.venv|venv\//i.test(cmd)) return false
  return true
}

export function pathHasEmoji(p) {
  return EMOJI_RE.test(String(p ?? ''))
}

export function codeContentHasEmoji(path, content) {
  if (!CODE_EXT.test(String(path ?? ''))) return false
  return EMOJI_RE.test(String(content ?? ''))
}

function deny(tool, detail) {
  return {
    kind: 'deny',
    reason:
      '[one-shot-guard] denied ' +
      tool +
      ': ' +
      detail +
      ' NEXT: do NOT probe (pwd/ls/python --version). ' +
      'If emoji denied: rewrite the SAME file with ASCII [OK]/[FAIL]/[WARN] only, then Write again. ' +
      'Otherwise Write <HOST_SHARE>/<script>.py and run: python3 /mnt/hostshare/<script>.py. ' +
      'Assume python3 exists.',
  }
}

export function apply(ctx) {
  ctx.on(
    'tools/pre-execute',
    (exec, next) => {
      try {
        const tool = exec?.name ?? ''

        if (DENY_TOOLS.has(tool)) {
          return Promise.resolve(deny(tool, 'todo_write is disabled'))
        }

        if (tool === 'bash' || tool === 'Bash') {
          const command = bashCommand(exec)
          const mode = (process.env.DEEP_AUTO_MODE || 'heuristic').toLowerCase()
          const denyP =
            mode === 'llm' || mode === 'auto'
              ? shouldDenyBashAsync(command, { mode: 'llm' })
              : Promise.resolve(shouldDenyBash(command))
          return denyP.then((blocked) => {
            if (blocked) {
              return deny(
                'bash',
                mode === 'llm' || mode === 'auto'
                  ? 'destructive or high-risk command blocked (auto-mode llm)'
                  : 'destructive or high-risk command blocked (auto-mode lite)',
              )
            }
            if (isWastefulBash(command)) {
              return deny('bash', 'wasteful probe (' + String(command).slice(0, 100) + ')')
            }
            if (isBadPip(command)) {
              return deny(
                'bash',
                'pip outside projects/*/venv or --break-system-packages; prefer stdlib or venv under /mnt/hostshare/projects/<slug>/.venv',
              )
            }
            return next()
          })
        }

        if (tool === 'write' || tool === 'Write' || tool === 'edit' || tool === 'Edit') {
          const path = writePath(exec)
          const content = writeContent(exec)
          if (shouldDenyWrite(path)) {
            return Promise.resolve(deny(tool, 'blocked path (secrets/VCS/system)'))
          }
          if (pathHasEmoji(path)) {
            return Promise.resolve(deny(tool, 'emoji in filename'))
          }
          if (isShareRootDoc(path)) {
            return Promise.resolve(
              deny(
                tool,
                'doc "' + basename(path) + '" outside projects/ — skip or put under projects/<slug>/',
              ),
            )
          }
          if (codeContentHasEmoji(path, content)) {
            return Promise.resolve(
              deny(tool, 'emoji in source — use [OK]/[FAIL]/[WARN]'),
            )
          }
        }
      } catch {
        /* never break waterfall */
      }
      return next()
    },
    { prepend: true },
  )
}

export default { name, inject, apply }
