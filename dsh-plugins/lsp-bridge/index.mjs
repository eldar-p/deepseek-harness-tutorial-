/**
 * LSP bridge for Deep DSH — hover / definition / references / symbols via host LSP.
 * Env: DEEP_WORKSPACE, DEEP_PKG_ROOT (optional)
 */
export const name = 'lsp-bridge'
export const inject = ['tools']

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'

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

const textOut = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string', required: true },
      isError: { type: 'boolean' },
    },
  },
  render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'lsp_query',
      description:
        'Language intelligence: hover, definition, references, or document symbols via host LSP. Paths relative to /workspace.',
      parameters: {
        op: {
          type: 'string',
          required: true,
          enum: ['hover', 'definition', 'references', 'symbols'],
          description: 'LSP operation',
        },
        path: { type: 'string', required: true, description: 'File path relative to workspace' },
        line: { type: 'number', description: '0-based line' },
        character: { type: 'number', description: '0-based column' },
      },
      output: textOut,
      async execute(args) {
        const lsp = await loadLsp()
        if (!lsp?.lspQuery) {
          return { text: 'lsp-bridge module unavailable on host', isError: true }
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
            text: `LSP unavailable: ${r.error}${r.server ? ` (server=${r.server})` : ''}. Install typescript-language-server / pyright on the host.`,
            isError: true,
          }
        }
        return { text: JSON.stringify(r.result ?? null, null, 2).slice(0, 8000) }
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'lsp_servers',
      description: 'List host language servers detected on PATH',
      parameters: {},
      output: textOut,
      async execute() {
        const lsp = await loadLsp()
        if (!lsp?.listAvailableServers) return { text: '[]', isError: true }
        return { text: JSON.stringify(lsp.listAvailableServers(), null, 2) }
      },
    }),
  )
}

export default { name, inject, apply }
