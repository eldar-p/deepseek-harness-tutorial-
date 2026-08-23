/**
 * DSH shell executor: every `bash` tool call → guest VM.
 * VM_EXEC = absolute path to host/vm-exec.ps1 (Windows) or host-mac/vm-exec.sh (macOS/Linux).
 */
import { LocalBashExecutor } from '@deepseek-ai/dsh-bash-local'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform } from 'node:os'

const here = fileURLToPath(new URL('.', import.meta.url))
const isWin = platform() === 'win32'
const defaultExec = isWin
  ? join(here, '..', '..', 'host', 'vm-exec.ps1')
  : join(here, '..', '..', 'host-mac', 'vm-exec.sh')
const VM_EXEC = process.env.VM_EXEC || defaultExec

function pwshExe() {
  const root = process.env.SystemRoot ?? 'C:\\Windows'
  return join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

class VmBashExecutor extends LocalBashExecutor {
  get sandboxMode() {
    return 'danger-full-access'
  }

  vmArgv(command) {
    const usePs1 = isWin && /\.ps1$/i.test(VM_EXEC)
    if (usePs1) {
      return [
        pwshExe(),
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        VM_EXEC,
        '-Command',
        command,
      ]
    }
    return ['/bin/bash', VM_EXEC, command]
  }

  run(spec) {
    return this.runArgv(spec, this.vmArgv(spec.command))
  }

  start(spec) {
    return this.startArgv(spec, this.vmArgv(spec.command))
  }
}

export default VmBashExecutor
