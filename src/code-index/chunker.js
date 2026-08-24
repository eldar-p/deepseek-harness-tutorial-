import fs from 'node:fs'
import path from 'node:path'

/** @typedef {{ path: string, symbol: string, kind: string, startLine: number, endLine: number, text: string, lang: string }} CodeChunk */

const CODE_EXTS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.go', '.rs', '.java', '.rb', '.php',
  '.vue', '.svelte', '.css', '.scss', '.html',
])

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.deep', 'dist', 'build', '.lance', '__pycache__',
  '.next', 'coverage', '.cache', 'vendor',
])

const SYMBOL_RE = {
  js: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?class\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^export\s+(?:async\s+)?function\s*\*\s+(\w+)/,
  py: /^(?:async\s+)?def\s+(\w+)|^class\s+(\w+)/,
}

/**
 * @param {string} filePath
 */
export function langForPath(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(ext)) return 'js'
  if (ext === '.py') return 'py'
  return 'text'
}

/**
 * Walk workspace and collect indexable source files.
 * @param {string} root
 * @param {{ maxFiles?: number }} [opts]
 * @returns {string[]}
 */
export function listSourceFiles(root, opts = {}) {
  const max = opts.maxFiles ?? 5000
  /** @type {string[]} */
  const out = []
  /** @param {string} dir */
  function walk(dir) {
    if (out.length >= max) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (out.length >= max) break
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (IGNORE_DIRS.has(ent.name)) continue
        walk(full)
        continue
      }
      const ext = ent.name.slice(ent.name.lastIndexOf('.')).toLowerCase()
      if (CODE_EXTS.has(ext)) out.push(full)
    }
  }
  walk(root)
  return out
}

/**
 * Regex/heuristic chunker — tree-sitter upgrade via optional/code-index.
 * @param {string} relPath workspace-relative
 * @param {string} text
 * @returns {CodeChunk[]}
 */
export function chunkSource(relPath, text) {
  const lang = langForPath(relPath)
  const lines = text.split(/\r?\n/)
  /** @type {CodeChunk[]} */
  const chunks = []

  if (lang === 'js' || lang === 'py') {
    const re = SYMBOL_RE[lang]
    /** @type {number|null} */
    let blockStart = null
    /** @type {string} */
    let blockSymbol = ''
    /** @type {string} */
    let blockKind = 'block'
    let depth = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const m = re.exec(line.trim())
      if (m) {
        if (blockStart != null && i > blockStart) {
          chunks.push(makeChunk(relPath, lang, blockSymbol, blockKind, lines, blockStart, i - 1))
        }
        blockStart = i
        blockSymbol = m[1] || m[2] || m[3] || m[4] || 'anonymous'
        blockKind = line.includes('class ') ? 'class' : line.includes('function') || line.includes('def ') ? 'function' : 'const'
        depth = braceDepth(line)
        continue
      }
      if (blockStart != null) {
        depth += braceDepth(line)
        if (depth <= 0 && (lang === 'js' ? line.trim() === '}' : line.trim() === '' && i > blockStart + 2)) {
          chunks.push(makeChunk(relPath, lang, blockSymbol, blockKind, lines, blockStart, i))
          blockStart = null
          depth = 0
        }
      }
    }
    if (blockStart != null) {
      chunks.push(makeChunk(relPath, lang, blockSymbol, blockKind, lines, blockStart, lines.length - 1))
    }
  }

  if (chunks.length === 0 && text.trim()) {
    // Fallback: sliding window by lines (compact context slices)
    const window = 40
    for (let i = 0; i < lines.length; i += window) {
      const end = Math.min(lines.length - 1, i + window - 1)
      chunks.push(makeChunk(relPath, lang, `chunk_${i + 1}`, 'fragment', lines, i, end))
    }
  }
  return chunks
}

/**
 * @param {string} line
 */
function braceDepth(line) {
  let d = 0
  for (const ch of line) {
    if (ch === '{') d++
    if (ch === '}') d--
  }
  return d
}

/**
 * @param {string} relPath
 * @param {string} lang
 * @param {string} symbol
 * @param {string} kind
 * @param {string[]} lines
 * @param {number} start
 * @param {number} end
 */
function makeChunk(relPath, lang, symbol, kind, lines, start, end) {
  const slice = lines.slice(start, end + 1).join('\n')
  return {
    path: relPath.replace(/\\/g, '/'),
    symbol,
    kind,
    startLine: start + 1,
    endLine: end + 1,
    text: slice.slice(0, 8000),
    lang,
  }
}

/** Try tree-sitter AST chunking when optional deps are installed. */
export async function chunkWithTreeSitter(relPath, text) {
  try {
    const optionalRoot = new URL('../../../optional/code-index/node_modules/', import.meta.url)
    const Parser = (await import(new URL('web-tree-sitter', optionalRoot).href)).default
    await Parser.init()
    const lang = langForPath(relPath)
    const langFile =
      lang === 'py'
        ? 'tree-sitter-python/tree-sitter-python.wasm'
        : 'tree-sitter-typescript/tree-sitter-typescript.wasm'
    const Lang = await Parser.Language.load(new URL(langFile, optionalRoot).href)
    const parser = new Parser()
    parser.setLanguage(Lang)
    const tree = parser.parse(text)
    /** @type {CodeChunk[]} */
    const out = []
    const targets = new Set(['function_declaration', 'method_definition', 'class_declaration', 'export_statement'])
    /** @param {import('web-tree-sitter').SyntaxNode} node */
    function walk(node) {
      if (targets.has(node.type)) {
        const start = node.startPosition.row
        const end = node.endPosition.row
        const lines = text.split(/\r?\n/)
        const nameNode = node.childForFieldName('name')
        out.push(makeChunk(
          relPath,
          lang,
          nameNode?.text || node.type,
          node.type.replace(/_declaration$/, ''),
          lines,
          start,
          end,
        ))
      }
      for (let i = 0; i < node.childCount; i++) walk(node.child(i))
    }
    walk(tree.rootNode)
    return out.length ? out : chunkSource(relPath, text)
  } catch {
    return chunkSource(relPath, text)
  }
}
