import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDeepPlugins, listPatchedPluginIds, formatPluginValidation } from '../src/plugin-validate.js'
import fs from 'node:fs'
import path from 'node:path'
import { PKG_ROOT } from '../src/paths.js'

test('listPatchedPluginIds from cordis patch', () => {
  const patch = fs.readFileSync(path.join(PKG_ROOT, 'assets', 'cordis.deep.patch.yml'), 'utf8')
  const ids = listPatchedPluginIds(patch)
  assert.ok(ids.includes('lsp-bridge'))
  assert.ok(ids.includes('guest-bash-local'))
})

test('validateDeepPlugins passes for repo tree', () => {
  const r = validateDeepPlugins()
  assert.equal(r.ok, true, formatPluginValidation(r))
})

test('formatPluginValidation OK line', () => {
  assert.match(formatPluginValidation({ ok: true, issues: [] }), /OK/)
})
