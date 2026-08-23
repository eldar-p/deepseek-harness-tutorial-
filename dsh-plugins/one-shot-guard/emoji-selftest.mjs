import { codeContentHasEmoji } from './index.mjs'

function check(name, path, content, expect) {
  const got = codeContentHasEmoji(path, content)
  console.log(got === expect ? 'OK' : 'FAIL', name, 'got', got)
  if (got !== expect) process.exitCode = 1
}

check('ascii', 'a.py', 'print("[OK]")', false)
check('emoji check', 'a.py', 'print("\u2705")', true)
check('arrow', 'a.py', 'x = "\u2192"', false)
check('box', 'a.py', '# \u2500\u2500', false)
