/**
 * LSP bridge for Deep DSH — hover / definition / references / symbols via host LSP.
 * Env: DEEP_WORKSPACE, DEEP_PKG_ROOT (optional)
 */
export const name = 'lsp-bridge'
export const inject = ['tools']

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function hostRoot() {
  return process.env.DEEP_WORKSPACE || process.cwd()
}

function toHostPath(guestOrRel) {
  const s = String(guestOrRel || '').replace(/^[/\\]?workspace[/\\]?/i, '').replace(/^\.\//, '')
  return path.join(hostRoot(), s)
}

async function loadLsp() {
  const candidates = [
    process.env.DEEP_PKG_ROOT ? path.join(process.env.DEEP_PKG_ROOT, 'src', 'lsp-bridge.js') : null,
    path.join(hostRoot(), '..', '..', 'src', 'lsp-bridge.js'),
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return await import(pathToFileURL(c).href)
    } catch {
      /* */
    }
  }
  try {
    return await import('../../src/lsp-bridge.js')
  } catch {
    return null
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tool('lsp_query', {
    description:
      'Language intelligence: hover, definition, references, or document symbols via host LSP. Paths relative to /workspace.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['hover', 'definition', 'references', 'symbols'] },
        path: { type: 'string', description: 'File path relative to workspace' },
        line: { type: 'number', description: '0-based line' },
        character: { type: 'number', description: '0-based column' },
      },
      required: ['op', 'path'],
    },
    async execute(args) {
      const lsp = await loadLsp()
      if (!lsp?.lspQuery) {
        return { content: 'lsp-bridge module unavailable on host', isError: true }
      }
      const r = await lsp.lspQuery({
        op: args.op,
        file: toHostPath(args.path),
        line: args.line ?? 0,
        character: args.character ?? 0,
        workspace: hostRoot(),
      })
      if (!r.ok) {
        return {
          content: `LSP unavailable: ${r.error}${r.server ? ` (server=${r.server})` : ''}. Install typescript-language-server / pyright on the host.`,
          isError: true,
        }
      }
      return { content: JSON.stringify(r.result ?? null, null, 2).slice(0, 8000) }
    },
  })

  ctx.tool('lsp_servers', {
    description: 'List host language servers detected on PATH',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const lsp = await loadLsp()
      if (!lsp?.listAvailableServers) return { content: '[]', isError: true }
      return { content: JSON.stringify(lsp.listAvailableServers(), null, 2) }
    },
  })
}

export default { name, inject, apply }
