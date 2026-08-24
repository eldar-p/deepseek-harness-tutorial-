/**
 * DSH bash executor → gim-guest container (docker/podman exec).
 * Env: GIM_ENGINE (docker|podman), GIM_GUEST_NAME, GIM_WORKSPACE (host path, info only).
 */
import { LocalBashExecutor } from '@deepseek-ai/dsh-bash-local'

function engineBin() {
  return process.env.GIM_ENGINE || 'docker'
}

function guestName() {
  return process.env.GIM_GUEST_NAME || 'gim-guest-default'
}

class GuestBashExecutor extends LocalBashExecutor {
  get sandboxMode() {
    return 'danger-full-access'
  }

  guestArgv(command) {
    const bin = engineBin()
    const name = guestName()
    return [bin, 'exec', '-i', '-w', '/workspace', name, 'bash', '-lc', command]
  }

  run(spec) {
    return this.runArgv(spec, this.guestArgv(spec.command))
  }

  start(spec) {
    return this.startArgv(spec, this.guestArgv(spec.command))
  }
}

export default GuestBashExecutor
