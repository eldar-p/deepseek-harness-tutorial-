/**
 * DSH shell executor: every `bash` tool call → guest VM via vm-exec.ps1.
 * VM_EXEC = absolute path to host/vm-exec.ps1 (set by install.ps1).
 */
import { LocalBashExecutor } from '@deepseek-ai/dsh-bash-local'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const defaultExec = join(here, '..', '..', 'host', 'vm-exec.ps1')
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

  run(spec) {
    return this.runArgv(spec, this.vmArgv(spec.command))
  }

  start(spec) {
    return this.startArgv(spec, this.vmArgv(spec.command))
  }
}

export default VmBashExecutor
