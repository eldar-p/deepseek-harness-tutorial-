import test from 'node:test'
import assert from 'node:assert/strict'
import { paint, row, printStatusScreen } from '../src/status-ui.js'

test('paint returns text without NO_COLOR', () => {
  const prev = process.env.NO_COLOR
  process.env.NO_COLOR = '1'
  assert.equal(paint('green', 'ok'), 'ok')
  if (prev === undefined) delete process.env.NO_COLOR
  else process.env.NO_COLOR = prev
})

test('row contains label', () => {
  const line = row('Engine', 'green', 'docker ok')
  assert.match(line, /Engine/)
  assert.match(line, /docker ok/)
})

test('row yellow and red tags', () => {
  assert.match(row('Guest', 'yellow', 'starting'), /YELLOW|Guest/)
  assert.match(row('Llama', 'red', 'down'), /RED|Llama/)
})

test('printStatusScreen prints urls', () => {
  printStatusScreen({
    stack: 'default',
    preset: 'balanced',
    engine: { level: 'green', detail: 'ok' },
    guest: { level: 'yellow', detail: 'n/a' },
    llama: { level: 'red', detail: 'off' },
    dsh: { level: 'red', detail: 'off' },
    gpu: { level: 'green', detail: 'free' },
    net: { level: 'green', detail: 'allowlist' },
    reboot: { level: 'green', detail: 'no' },
    urls: { dsh: 'http://127.0.0.1:1/', llama: 'http://127.0.0.1:2/v1' },
  })
})
