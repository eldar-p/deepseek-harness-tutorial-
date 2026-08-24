/** Color helpers for one-screen status (ANSI; plain if NO_COLOR). */
const useColor = !process.env.NO_COLOR && process.stdout.isTTY

const C = {
  reset: useColor ? '\x1b[0m' : '',
  green: useColor ? '\x1b[32m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  red: useColor ? '\x1b[31m' : '',
  dim: useColor ? '\x1b[2m' : '',
  bold: useColor ? '\x1b[1m' : '',
}

export function paint(level, text) {
  const col = level === 'green' ? C.green : level === 'yellow' ? C.yellow : level === 'red' ? C.red : C.dim
  return `${col}${text}${C.reset}`
}

export function row(label, level, detail = '') {
  const tag =
    level === 'green' ? paint('green', 'GREEN') : level === 'yellow' ? paint('yellow', 'YELLOW') : paint('red', 'RED')
  const pad = label.padEnd(10)
  return `${pad} ${tag}  ${detail}`
}

export function printStatusScreen(s) {
  console.log('')
  console.log(`${C.bold}Deep status${C.reset}  stack=${s.stack}  preset=${s.preset}`)
  console.log('─'.repeat(56))
  console.log(row('Engine', s.engine.level, s.engine.detail))
  console.log(row('Guest', s.guest.level, s.guest.detail))
  console.log(row('Llama', s.llama.level, s.llama.detail))
  console.log(row('DSH', s.dsh.level, s.dsh.detail))
  console.log(row('GPU/RAM', s.gpu.level, s.gpu.detail))
  console.log(row('Net', s.net.level, s.net.detail))
  console.log(row('Reboot', s.reboot.level, s.reboot.detail))
  if (s.urls?.dsh) {
    console.log('─'.repeat(56))
    console.log(`DSH:   ${s.urls.dsh}`)
    console.log(`Llama: ${s.urls.llama}`)
  }
  console.log('')
}
