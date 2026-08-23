import { isWastefulBash } from './index.mjs'

function assert(name, got, exp) {
  const ok = got === exp
  console.log(ok ? 'OK' : 'FAIL', name, '=>', got)
  if (!ok) process.exitCode = 1
}

assert('pwd ls', isWastefulBash('pwd && ls -la'), true)
assert('py version', isWastefulBash('python3 --version'), true)
assert('py -c version', isWastefulBash("python3 -c 'import sys; print(sys.version)'"), true)
assert('command -v', isWastefulBash('command -v python3'), true)
assert('real run', isWastefulBash('python3 /mnt/hostshare/ws_check.py --help'), false)
