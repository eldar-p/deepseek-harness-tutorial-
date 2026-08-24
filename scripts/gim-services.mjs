#!/usr/bin/env node
/** Detached stack services (code index HTTP, egress proxy). */
import { startEgressProxy } from '../src/egress-proxy.js'
import { resolveAllowlist } from '../src/guest.js'
import { startCodeIndexFromEnv } from '../src/index-sidecar.js'

const svc = process.argv[2]

if (svc === 'index') {
  await startCodeIndexFromEnv()
}

if (svc === 'egress-proxy') {
  const port = Number(process.env.GIM_PROXY_PORT || 14250)
  const preset = process.env.GIM_NET_PRESET || 'allowlist'
  const allow = resolveAllowlist(preset)
  const bind = process.env.GIM_PROXY_BIND || '0.0.0.0'
  const r = await startEgressProxy({
    port,
    allowHosts: allow,
    bind,
    log: (m) => console.log(`[egress-proxy] ${m}`),
  })
  console.log(`[egress-proxy] listening ${r.url} allow=${allow.join(',')}`)
}

if (!svc || !['index', 'egress-proxy'].includes(svc)) {
  console.error('Usage: gim-services.mjs <index|egress-proxy>')
  process.exit(2)
}
