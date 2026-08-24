# Troubleshooting

## Engine RED — docker/podman not found

1. **Run the Docker Desktop installer** (not just download — finish setup).
2. Reboot if the installer asks.
3. Start **Docker Desktop** from Start menu; wait until the whale icon is steady/green.
4. Verify:

```powershell
powershell -File .\scripts\wait-docker.ps1
docker version
deep doctor
```

If `docker` works in a **new** terminal but `deep doctor` still fails, set:

```powershell
$env:DEEP_DOCKER_BIN = "C:\Users\<you>\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
# or legacy install:
# $env:DEEP_DOCKER_BIN = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
```

Then `deep start` again — guest should build `deep-guest:prealpha` on first run (~1 min).

## Guest build fails — docker-credential-desktop not found

Symptom during `deep start`:

```text
error getting credentials - err: exec: "docker-credential-desktop": executable file not found in %PATH%
```

**Cause:** Node spawns `docker` without Docker Desktop's `resources\bin` on PATH (credential helper lives there).

**Fix (built-in):** Deep CLI prepends the docker bin directory to PATH for all container commands (`engineEnv` in `src/detect.js`). Update to latest `main` and retry.

**Manual workaround:**

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:PATH"
deep start --cpu
```

## Llama RED / health timeout

```bash
# Logs
type %USERPROFILE%\.deep\run\default\llama.log   # Windows
cat ~/.deep/run/default/llama.log               # Unix

# CPU fallback
deep start --cpu --gguf PATH
```

CUDA build needs pinned zip or `DEEP_LLAMA_BIN`.

## DSH RED / plugin tree failed

Re-materialize:

```bash
deep bootstrap
```

Check `~/.deep/dsh-home/profiles/web/cordis.patch.yml` — duplicate ids break DSH 0.1.1-rc.2.

## Q3 quant warnings

Prefer **Q4_K_M** or higher for tool-heavy agents. See audit #26 / `deep start` yellow lines.

## Long sessions / context full

DSH auto-compacts at ~50% of the context window (see `cordis.deep.patch.yml`).

- In DSH chat, run **`/compact`** to force a summary now
- Large tool output is pruned at 4k chars — full logs belong in `workspace/logs/`
- Durable facts (with user consent) → `.deep/memory.json` (see `AGENTS.md`)

After compaction, re-read files instead of relying on old tool output in history.

## Multi-stack

```bash
deep start --name dev
deep status --name dev
deep status --all
deep stacks
deep stop --name dev
```

Only one **GPU** stack at a time. If start fails with GPU lock, stop the other stack or use `--cpu`.

## Guest network allowlist

Preset `balanced` / `dev`:

1. Host injects `DEEP_NET_MODE` / `DEEP_NET_ALLOWLIST`
2. Guest entrypoint `deep-net-enforce` applies **iptables** OUTPUT allowlist (needs `NET_ADMIN`)
3. `offline` / `paranoia` → `--network none`

```bash
docker exec deep-guest-default printenv DEEP_NET_ALLOWLIST
docker logs deep-guest-default 2>&1 | findstr deep-net
```

Hard proxy sidecar — future; current filter is DNS→IP iptables (IPv4).

## Port already in use

`deep stop` then `deep start`. Stacks use random ports in 13000–14000 (DSH) and 18000–19000 (llama).

## Ctrl+C left processes

Pre-alpha: signal handler runs `deep stop`. If hung: `deep stop --emergency`.

## GitHub / push

Auth is user-side; local work does not require push for pre-alpha.
