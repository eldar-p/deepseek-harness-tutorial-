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
    quant: { level: 'yellow', detail: 'Q3_K_M — weak for tools' },
    gpu: { level: 'green', detail: 'free' },
    net: { level: 'green', detail: 'allowlist' },
    reboot: { level: 'green', detail: 'no' },
    urls: { dsh: 'http://127.0.0.1:1/', llama: 'http://127.0.0.1:2/v1' },
  })
})

test('printStatusScreen includes Quant row when set', () => {
  let buf = ''
  const orig = console.log
  console.log = (...a) => {
    buf += a.join(' ') + '\n'
  }
  try {
    printStatusScreen({
      stack: 't',
      preset: 'dev',
      engine: { level: 'green', detail: 'ok' },
      guest: { level: 'green', detail: 'ok' },
      llama: { level: 'green', detail: 'ok' },
      dsh: { level: 'green', detail: 'ok' },
      quant: { level: 'yellow', detail: 'Q3_K_M weak' },
      gpu: { level: 'green', detail: 'ok' },
      net: { level: 'green', detail: 'ok' },
      reboot: { level: 'green', detail: 'ok' },
      urls: null,
    })
  } finally {
    console.log = orig
  }
  assert.match(buf, /Quant/)
  assert.match(buf, /Q3_K_M/)
})
