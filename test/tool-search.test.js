import test from 'node:test'
import assert from 'node:assert/strict'
import {
  searchDeferredTools,
  selectDeferredTool,
  formatToolSearchHits,
  DEFERRED_TOOLS,
} from '../src/tool-search.js'

test('searchDeferredTools matches lsp keywords', () => {
  const hits = searchDeferredTools('lsp definition pyright')
  assert.ok(hits.some((h) => h.id === 'lsp_query'))
})

test('selectDeferredTool +select:id', () => {
  assert.equal(selectDeferredTool('select:guest_bash')?.id, 'guest_bash')
  assert.equal(selectDeferredTool('+mcp_bridge')?.id, 'mcp_bridge')
  assert.equal(selectDeferredTool('nope'), null)
})

test('searchDeferredTools matches release and security', () => {
  assert.ok(searchDeferredTools('release tag doctor').some((h) => h.id === 'doctor_release'))
  assert.ok(searchDeferredTools('owasp security eval').some((h) => h.id === 'doctor_security'))
  assert.ok(searchDeferredTools('colibri warm kv').some((h) => h.id === 'colibri_speed'))
})

test('formatToolSearchHits non-empty', () => {
  const text = formatToolSearchHits(DEFERRED_TOOLS.slice(0, 2))
  assert.match(text, /code_search/)
})
