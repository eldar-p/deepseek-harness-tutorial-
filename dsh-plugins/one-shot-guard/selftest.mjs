import {
  isWastefulBash,
  isBadPip,
  underProjects,
  codeContentHasEmoji,
  pathHasEmoji,
} from './index.mjs'

function assert(name, cond) {
  console.log(cond ? 'OK' : 'FAIL', name)
  if (!cond) process.exitCode = 1
}

assert('pwd waste', isWastefulBash('pwd'))
assert('run ok', !isWastefulBash('python3 /mnt/hostshare/x.py'))
assert('pip bare bad', isBadPip('pip3 install requests'))
assert('pip break bad', isBadPip('pip3 install --break-system-packages x'))
assert('pip venv ok', !isBadPip('/mnt/hostshare/projects/app/.venv/bin/pip install requests'))
assert('under projects', underProjects('/mnt/hostshare/projects/app/README.md'))
assert('not under', !underProjects('/mnt/hostshare/README.md'))
assert('emoji code', codeContentHasEmoji('a.py', 'print("\u2705")'))
assert('no emoji', !codeContentHasEmoji('a.py', 'print("[OK]")'))
assert('emoji path', pathHasEmoji('F:/x/\u{1F600}.py'))
